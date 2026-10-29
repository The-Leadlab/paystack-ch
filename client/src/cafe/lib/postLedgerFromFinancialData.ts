import type { Expense, FinancialData, Income } from '../types';
import { DocumentType } from '../types';
import { mapAiExpenseCategoryToLedger, resolveFineExpenseCategory } from './mapExpenseCategory';
import {
  buildPayrollExpenseLines,
  isPayslipFinancialData,
  resolvePayrollSettlementMode,
} from '../services/swissPayrollService';
import { suggestSwissAccountCode } from '@shared/suggestSwissAccountCode';
import {
  canonicalizeSupplierName,
  resolveDocumentDate,
  resolveDocumentVatAmount,
  splitIssuerAndReference,
} from './swissDocumentNormalize';
import { isRevenueDocument } from '@shared/documentDirection';
import type { LedgerExpenseDraft, LedgerIncomeDraft } from '../context/FinanceContext';
import {
  resolveDocumentAmountInCHF,
  resolveSubInvoiceAmounts,
} from './subInvoiceAmounts';

type LedgerWriters = {
  addIncome: (
    date: string,
    type: 'SALES' | 'RESERVATION',
    amount: number,
    description: string | undefined,
    sessionId: string,
    documentId?: string,
    vatAmount?: number,
    accountCode?: string,
    aiCategory?: string,
    paymentMethod?: string | null
  ) => Promise<Income | null>;
  addExpense: (
    date: string,
    category: Expense['category'],
    amount: number,
    description: string,
    sessionId: string,
    employeeId?: string,
    documentId?: string,
    vatAmount?: number,
    accountCode?: string,
    aiCategory?: string
  ) => Promise<Expense | null>;
  /** Preferred for CSV / bank statements — avoids live UI count spam. */
  addLedgerEntriesBatch?: (
    incomeDrafts: LedgerIncomeDraft[],
    expenseDrafts: LedgerExpenseDraft[]
  ) => Promise<{ income: Income[]; expenses: Expense[] }>;
};

export type PostLedgerOptions = {
  /** Invoice Maker / profile names — issuer match → income (customer invoice). */
  ownBusinessNames?: string[];
};

function resolveAccountCode(
  data: FinancialData,
  opts: { kind: 'income' | 'expense'; category?: string; description?: string }
): string | undefined {
  if (opts.kind === 'income' && data.swissAccountClassification?.suggested_income_code) {
    return data.swissAccountClassification.suggested_income_code;
  }
  if (opts.kind === 'expense' && data.swissAccountClassification?.suggested_expense_code) {
    return data.swissAccountClassification.suggested_expense_code;
  }
  return suggestSwissAccountCode({
    kind: opts.kind,
    category: opts.category,
    incomeType: opts.kind === 'income' ? 'SALES' : undefined,
    description: `${data.issuer || ''} ${opts.description || data.notes || ''}`,
  });
}

function isRevenueDoc(
  data: FinancialData,
  ownBusinessNames?: string[],
  fileName?: string
): boolean {
  return isRevenueDocument(
    {
      documentType: data.documentType,
      expenseCategory: data.expenseCategory,
      issuer: data.issuer,
      recipient: data.recipient,
      notes: data.notes,
      aiInterpretation: data.aiInterpretation,
      fileName: fileName || data.sourceFileName,
      userFlowOverride: data.userFlowOverride,
      uploadIntent: data.uploadIntent,
      aiFlowHint: data.aiFlowHint,
    },
    ownBusinessNames
  );
}

function incomeTypeFromCategory(category?: string): 'SALES' | 'RESERVATION' {
  return String(category || '')
    .toUpperCase()
    .includes('RESERV')
    ? 'RESERVATION'
    : 'SALES';
}

function resolvePostedAmount(data: FinancialData): number {
  return resolveDocumentAmountInCHF(data);
}

async function postSingleAmount(
  writers: LedgerWriters,
  data: FinancialData,
  fileName: string,
  sessionId: string,
  documentId: string,
  ownBusinessNames?: string[]
): Promise<'income' | 'expense' | null> {
  const lineDates = (data.lineItems || []).map((l) => l.date);
  const date = resolveDocumentDate(
    data.date,
    (data as { paySlip?: { periodEnd?: string } }).paySlip?.periodEnd,
    ...lineDates
  );
  const amount = resolvePostedAmount(data);
  if (amount <= 0) return null;

  const cleanedIssuer = splitIssuerAndReference(data.issuer).issuer || data.issuer;
  const vendorName =
    canonicalizeSupplierName(cleanedIssuer, '') ||
    cleanedIssuer ||
    fileName;
  const lineProductHint = (data.lineItems || [])
    .map((l) => {
      const desc = String(l.description || '').trim();
      if (!desc) return '';
      const qty = l.quantity != null && Number(l.quantity) > 1 ? `${Number(l.quantity)}× ` : '';
      return `${qty}${desc}`;
    })
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
  const productHint =
    lineProductHint ||
    String(data.notes || '').trim() ||
    String(data.documentNumber ? `Doc ${data.documentNumber}` : '').trim();
  const vatAmount = resolveDocumentVatAmount(data);

  if (isRevenueDoc(data, ownBusinessNames, fileName)) {
    const incomeType = incomeTypeFromCategory(data.expenseCategory);
    const fallbackProduct =
      incomeType === 'RESERVATION' ? 'Reservation / booking' : 'Product / service sale';
    const description = productHint
      ? `${vendorName} — ${productHint}`
      : `${vendorName} — ${fallbackProduct}`;
    const code = resolveAccountCode(data, { kind: 'income', description });
    const fineIncome =
      incomeType === 'RESERVATION' ? 'RESERVATION' : 'SALES';
    await writers.addIncome(
      date,
      incomeType,
      amount,
      description,
      sessionId,
      documentId,
      vatAmount,
      code,
      fineIncome,
      data.paymentMethod || null
    );
    return 'income';
  }

  const description = productHint
    ? `${vendorName} — ${productHint}`
    : vendorName;

  const fineCategory = resolveFineExpenseCategory({
    expenseCategory: data.expenseCategory,
    issuer: data.issuer,
    description,
    notes: data.notes,
    documentType: data.documentType,
  });
  const category = mapAiExpenseCategoryToLedger({
    expenseCategory: fineCategory,
    issuer: data.issuer,
    description,
    notes: data.notes,
    documentType: data.documentType,
  });
  const splits = data.swissAccountClassification?.splits;
  if (splits?.length) {
    for (const split of splits) {
      const splitAmount = split.amount ?? amount / splits.length;
      await writers.addExpense(
        date,
        category,
        splitAmount,
        split.description || description,
        sessionId,
        undefined,
        documentId,
        vatAmount / splits.length,
        split.account_code,
        fineCategory
      );
    }
    return 'expense';
  }

  const code = resolveAccountCode(data, {
    kind: 'expense',
    category: fineCategory || category,
    description,
  });
  await writers.addExpense(
    date,
    category,
    amount,
    description,
    sessionId,
    undefined,
    documentId,
    vatAmount,
    code,
    fineCategory
  );
  return 'expense';
}

/**
 * Create income/expense rows from AI extraction.
 * Multi-invoice PDFs → one ledger row per subDocument (keeps dashboard in sync with detected invoices).
 * Bank Statement / CSV → batched writes when available (stable report totals).
 */
export async function postLedgerFromFinancialData(
  writers: LedgerWriters,
  data: FinancialData,
  fileName: string,
  sessionId: string,
  documentId: string,
  options?: PostLedgerOptions
): Promise<{ incomePosted: number; expensePosted: number }> {
  const docType = data.documentType;
  const ownBusinessNames = options?.ownBusinessNames;
  let incomePosted = 0;
  let expensePosted = 0;

  if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
    const incomeDrafts: LedgerIncomeDraft[] = [];
    const expenseDrafts: LedgerExpenseDraft[] = [];

    for (const item of data.lineItems || []) {
      const lineDate = resolveDocumentDate(item.date, data.date);
      if (item.type === 'INCOME') {
        const description = item.description || fileName;
        const code = resolveAccountCode(data, { kind: 'income', description });
        incomeDrafts.push({
          date: lineDate,
          type: incomeTypeFromCategory(item.category),
          amount: item.amount,
          description,
          sessionId,
          documentId,
          vatAmount: 0,
          accountCode: code,
          aiCategory: incomeTypeFromCategory(item.category),
        });
      } else if (item.type === 'EXPENSE') {
        const description =
          canonicalizeSupplierName(item.description || data.issuer, '') ||
          item.description ||
          data.issuer ||
          fileName;
        const fineCategory = resolveFineExpenseCategory({
          expenseCategory: item.category || item.description,
          issuer: data.issuer,
          description: item.description,
          documentType: docType,
        });
        const category = mapAiExpenseCategoryToLedger({
          expenseCategory: fineCategory,
          issuer: data.issuer,
          description: item.description,
          documentType: docType,
        });
        const code = resolveAccountCode(data, {
          kind: 'expense',
          category: fineCategory || category,
          description,
        });
        expenseDrafts.push({
          date: lineDate,
          category,
          amount: item.amount,
          description,
          sessionId,
          documentId,
          vatAmount: 0,
          accountCode: code,
          aiCategory: fineCategory,
        });
      }
    }

    if (writers.addLedgerEntriesBatch) {
      await writers.addLedgerEntriesBatch(incomeDrafts, expenseDrafts);
    } else {
      for (const draft of incomeDrafts) {
        await writers.addIncome(
          draft.date,
          draft.type,
          draft.amount,
          draft.description,
          draft.sessionId,
          draft.documentId,
          draft.vatAmount,
          draft.accountCode
        );
      }
      for (const draft of expenseDrafts) {
        await writers.addExpense(
          draft.date,
          draft.category,
          draft.amount,
          draft.description,
          draft.sessionId,
          draft.employeeId,
          draft.documentId,
          draft.vatAmount,
          draft.accountCode,
          draft.aiCategory
        );
      }
    }

    return { incomePosted: incomeDrafts.length, expensePosted: expenseDrafts.length };
  }

  if (docType === 'Pay Slip' || isPayslipFinancialData(data)) {
    const date = resolveDocumentDate(data.date, data.paySlip?.periodEnd);
    const paySlipBlocks: FinancialData[] = [];
    const subs = Array.isArray(data.subDocuments) ? data.subDocuments.filter(Boolean) : [];
    const distinctEmployees = new Set(
      subs
        .map((s) => String(s.paySlip?.employee?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    if (subs.length >= 2 && distinctEmployees.size >= 2) {
      for (const sub of subs) {
        paySlipBlocks.push({
          ...data,
          ...sub,
          documentType: DocumentType.PAY_SLIP,
          date: resolveDocumentDate(sub.date, sub.paySlip?.periodEnd, data.date),
          paySlip: sub.paySlip ?? data.paySlip,
          payrollSettlementMode: sub.payrollSettlementMode ?? data.payrollSettlementMode,
          expenseCategory: 'PAYROLL',
          vatAmount: 0,
          subDocuments: [],
        });
      }
    } else {
      // Same employee duplicated across pages/blocks → post once (not N× salary).
      paySlipBlocks.push({
        ...data,
        documentType: DocumentType.PAY_SLIP,
        expenseCategory: 'PAYROLL',
        vatAmount: 0,
        subDocuments: [],
      });
    }

    const seenPayrollKeys = new Set<string>();
    for (const block of paySlipBlocks) {
      const employeeName = block.paySlip?.employee?.name || 'Unknown Employee';
      const settlement = resolvePayrollSettlementMode(block);
      const payrollLines = buildPayrollExpenseLines(block, employeeName, settlement);
      const lineDate = resolveDocumentDate(block.date, block.paySlip?.periodEnd, date);
      for (const line of payrollLines) {
        const dedupeKey = `${lineDate}|${line.category}|${employeeName.trim().toLowerCase()}|${Math.round(line.amount * 100)}`;
        if (seenPayrollKeys.has(dedupeKey)) continue;
        seenPayrollKeys.add(dedupeKey);
        const code = suggestSwissAccountCode({
          kind: 'expense',
          category: line.category,
          description: line.description,
        });
        await writers.addExpense(
          lineDate,
          line.category,
          line.amount,
          line.description,
          sessionId,
          undefined,
          documentId,
          0, // payslips never carry TVA
          code,
          line.category
        );
        expensePosted += 1;
      }
    }
    return { incomePosted, expensePosted };
  }

  const subs = Array.isArray(data.subDocuments) ? data.subDocuments.filter(Boolean) : [];
  // Misclassified multi-page payslip binder: each page became a sub-invoice of the same salary.
  if (
    subs.length >= 2 &&
    subs.every((s) => isPayslipFinancialData(s) || isPayslipFinancialData({ ...data, ...s, paySlip: s.paySlip ?? data.paySlip }))
  ) {
    return postLedgerFromFinancialData(
      writers,
      {
        ...data,
        documentType: DocumentType.PAY_SLIP,
        expenseCategory: 'PAYROLL',
        vatAmount: 0,
        paySlip: data.paySlip ?? subs[0]?.paySlip,
      },
      fileName,
      sessionId,
      documentId,
      options
    );
  }
  if (subs.length > 0) {
    for (const sub of subs) {
      const amounts = resolveSubInvoiceAmounts(sub, data);
      const merged: FinancialData = {
        ...data,
        ...sub,
        // Prefer sub-invoice fields; do not inherit parent aggregated VAT / totals
        swissVatBreakdown: sub.swissVatBreakdown,
        swissVatReceiptTotals: sub.swissVatReceiptTotals,
        date: resolveDocumentDate(sub.date, data.date),
        totalAmount: amounts.totalAmount,
        amountInCHF: amounts.amountInCHF,
        conversionRateUsed: amounts.conversionRateUsed,
        vatAmount: resolveDocumentVatAmount({
          vatAmount: sub.vatAmount,
          vatRate: sub.vatRate,
          netAmount: sub.netAmount,
          totalAmount: amounts.totalAmount,
          amountInCHF: amounts.amountInCHF,
          swissVatBreakdown: sub.swissVatBreakdown,
          swissVatReceiptTotals: sub.swissVatReceiptTotals,
        }),
        documentType: sub.documentType || data.documentType,
        expenseCategory: sub.expenseCategory || data.expenseCategory,
        swissAccountClassification: sub.swissAccountClassification || undefined,
        userFlowOverride: sub.userFlowOverride || data.userFlowOverride,
        sourceFileName: data.sourceFileName || fileName,
        paymentMethod: sub.paymentMethod || data.paymentMethod,
        // Prevent nested re-entry into the multi-invoice branch
        subDocuments: [],
      };
      const kind = await postSingleAmount(
        writers,
        merged,
        fileName,
        sessionId,
        documentId,
        ownBusinessNames
      );
      if (kind === 'income') incomePosted += 1;
      if (kind === 'expense') expensePosted += 1;
    }
    return { incomePosted, expensePosted };
  }

  const kind = await postSingleAmount(
    writers,
    data,
    fileName,
    sessionId,
    documentId,
    ownBusinessNames
  );
  if (kind === 'income') incomePosted += 1;
  if (kind === 'expense') expensePosted += 1;

  return { incomePosted, expensePosted };
}
