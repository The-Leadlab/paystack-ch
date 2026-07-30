import type { Expense, FinancialData, Income } from '../types';
import { mapAiExpenseCategoryToLedger } from './mapExpenseCategory';
import {
  buildPayrollExpenseLines,
  resolvePayrollSettlementMode,
} from '../services/swissPayrollService';
import { suggestSwissAccountCode } from '@shared/suggestSwissAccountCode';
import {
  canonicalizeSupplierName,
  resolveDocumentDate,
  resolveDocumentVatAmount,
  splitIssuerAndReference,
} from './swissDocumentNormalize';

type LedgerWriters = {
  addIncome: (
    date: string,
    type: 'SALES' | 'RESERVATION',
    amount: number,
    description: string | undefined,
    sessionId: string,
    documentId?: string,
    vatAmount?: number,
    accountCode?: string
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
    accountCode?: string
  ) => Promise<Expense | null>;
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

function isRevenueDoc(data: FinancialData): boolean {
  const cat = String(data.expenseCategory || '').toUpperCase();
  const docType = data.documentType;
  return (
    cat.includes('REVENUE') ||
    cat.includes('SALES') ||
    docType === 'Ticket/Receipt' ||
    docType === 'Z2 Multi-Ticket Sheet'
  );
}

async function postSingleAmount(
  writers: LedgerWriters,
  data: FinancialData,
  fileName: string,
  sessionId: string,
  documentId: string
): Promise<'income' | 'expense' | null> {
  const lineDates = (data.lineItems || []).map((l) => l.date);
  const date = resolveDocumentDate(
    data.date,
    (data as { paySlip?: { periodEnd?: string } }).paySlip?.periodEnd,
    ...lineDates
  );
  const amount = data.amountInCHF || data.totalAmount || 0;
  if (amount <= 0) return null;

  const cleanedIssuer = splitIssuerAndReference(data.issuer).issuer || data.issuer;
  const description =
    canonicalizeSupplierName(cleanedIssuer, '') ||
    cleanedIssuer ||
    data.notes ||
    fileName;
  const vatAmount = resolveDocumentVatAmount(data);

  if (isRevenueDoc(data)) {
    const code = resolveAccountCode(data, { kind: 'income', description });
    await writers.addIncome(date, 'SALES', amount, description, sessionId, documentId, vatAmount, code);
    return 'income';
  }

  const category = mapAiExpenseCategoryToLedger({
    expenseCategory: data.expenseCategory,
    issuer: data.issuer,
    description: description,
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
        split.account_code
      );
    }
    return 'expense';
  }

  const code = resolveAccountCode(data, { kind: 'expense', category, description });
  await writers.addExpense(
    date,
    category,
    amount,
    description,
    sessionId,
    undefined,
    documentId,
    vatAmount,
    code
  );
  return 'expense';
}

/**
 * Create income/expense rows from AI extraction.
 * Multi-invoice PDFs → one ledger row per subDocument (keeps dashboard in sync with detected invoices).
 */
export async function postLedgerFromFinancialData(
  writers: LedgerWriters,
  data: FinancialData,
  fileName: string,
  sessionId: string,
  documentId: string
): Promise<{ incomePosted: number; expensePosted: number }> {
  const docType = data.documentType;
  let incomePosted = 0;
  let expensePosted = 0;

  if (docType === 'Bank Statement' || docType === 'Bank Deposit') {
    const date = resolveDocumentDate(data.date);
    for (const item of data.lineItems || []) {
      const lineDate = resolveDocumentDate(item.date, data.date);
      if (item.type === 'INCOME') {
        const description = item.description || fileName;
        const code = resolveAccountCode(data, { kind: 'income', description });
        await writers.addIncome(
          lineDate,
          'SALES',
          item.amount,
          description,
          sessionId,
          documentId,
          0,
          code
        );
        incomePosted += 1;
      } else if (item.type === 'EXPENSE') {
        const description =
          canonicalizeSupplierName(item.description || data.issuer, '') ||
          item.description ||
          data.issuer ||
          fileName;
        const category = mapAiExpenseCategoryToLedger({
          expenseCategory: item.category || item.description,
          issuer: data.issuer,
          description: item.description,
          documentType: docType,
        });
        const code = resolveAccountCode(data, { kind: 'expense', category, description });
        await writers.addExpense(
          lineDate,
          category,
          item.amount,
          description,
          sessionId,
          undefined,
          documentId,
          0,
          code
        );
        expensePosted += 1;
      }
    }
    return { incomePosted, expensePosted };
  }

  if (docType === 'Pay Slip') {
    const employeeName = data.paySlip?.employee?.name || 'Unknown Employee';
    const settlement = resolvePayrollSettlementMode(data);
    const payrollLines = buildPayrollExpenseLines(data, employeeName, settlement);
    const date = resolveDocumentDate(data.date, data.paySlip?.periodEnd);
    for (const line of payrollLines) {
      const code = suggestSwissAccountCode({
        kind: 'expense',
        category: line.category,
        description: line.description,
      });
      await writers.addExpense(
        date,
        line.category,
        line.amount,
        line.description,
        sessionId,
        undefined,
        documentId,
        undefined,
        code
      );
      expensePosted += 1;
    }
    return { incomePosted, expensePosted };
  }

  const subs = Array.isArray(data.subDocuments) ? data.subDocuments.filter(Boolean) : [];
  if (subs.length > 0) {
    for (const sub of subs) {
      const merged: FinancialData = {
        ...data,
        ...sub,
        // Prefer sub-invoice fields; do not inherit parent aggregated VAT for each row
        swissVatBreakdown: sub.swissVatBreakdown,
        swissVatReceiptTotals: sub.swissVatReceiptTotals,
        date: resolveDocumentDate(sub.date, data.date),
        vatAmount: resolveDocumentVatAmount({
          vatAmount: sub.vatAmount,
          vatRate: sub.vatRate,
          netAmount: sub.netAmount,
          totalAmount: sub.totalAmount,
          amountInCHF: sub.amountInCHF ?? sub.totalAmount,
          swissVatBreakdown: sub.swissVatBreakdown,
          swissVatReceiptTotals: sub.swissVatReceiptTotals,
        }),
        documentType: sub.documentType || data.documentType,
        expenseCategory: sub.expenseCategory || data.expenseCategory,
        swissAccountClassification: sub.swissAccountClassification || undefined,
      };
      const kind = await postSingleAmount(writers, merged, fileName, sessionId, documentId);
      if (kind === 'income') incomePosted += 1;
      if (kind === 'expense') expensePosted += 1;
    }
    return { incomePosted, expensePosted };
  }

  const kind = await postSingleAmount(writers, data, fileName, sessionId, documentId);
  if (kind === 'income') incomePosted += 1;
  if (kind === 'expense') expensePosted += 1;

  return { incomePosted, expensePosted };
}
