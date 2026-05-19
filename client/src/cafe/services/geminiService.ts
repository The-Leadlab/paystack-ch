
import { generateGeminiContent, generateGeminiContentFromStorage } from "../lib/geminiClient";
import {
  ensureDocumentStorageForAi,
  type DocumentStorageRef,
} from "../lib/documentStorageForAi";
import { applyPayrollPaymentFields } from "./swissPayrollService";
import {
  DocumentType,
  FinancialData,
  BankTransaction,
  BankStatementAnalysis,
  SwissVatRateLine,
  SwissVatReceiptTotals,
  SwissVatFormPreview,
} from "../types";
import { prepareDocumentForAi } from "../lib/prepareDocumentForAi";

const Type = {
  ARRAY: "ARRAY",
  NUMBER: "NUMBER",
  OBJECT: "OBJECT",
  STRING: "STRING",
} as const;

/** Override with VITE_GEMINI_MODEL if a specific model works better for your API project. */
function resolveDocumentModel(): string {
  return import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function resolveBankStatementModel(): string {
  return import.meta.env.VITE_GEMINI_BANK_MODEL?.trim() || resolveDocumentModel();
}

type GeminiDiagnostics = { httpStatus: number | null; apiMessage: string; raw: string };

function diagnoseGeminiError(error: unknown): GeminiDiagnostics {
  const err = error as Record<string, unknown>;
  const raw =
    error instanceof Error ? error.message : typeof err?.message === "string" ? (err.message as string) : String(error);

  let httpStatus: number | null = typeof err?.status === "number" ? (err.status as number) : null;
  let apiMessage = raw;

  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const j = JSON.parse(raw.slice(jsonStart)) as { error?: { code?: number; message?: string; status?: string } };
      if (j?.error?.code !== undefined && !Number.isNaN(Number(j.error.code))) httpStatus = Number(j.error.code);
      if (typeof j?.error?.message === "string") apiMessage = j.error.message;
    } catch {
      const codeMatch = raw.match(/"code"\s*:\s*(\d{3})/);
      if (codeMatch) httpStatus = Number(codeMatch[1]);
    }
  }

  return { httpStatus, apiMessage, raw };
}

/** Do not backoff-retry deterministic client failures (slow + pointless). */
function geminiErrorIsRetryable(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  const em = error instanceof Error ? error.message : String(error);
  if (/unterminated string|invalid json|unexpected token|json\.parse/i.test(em)) return true;

  const { httpStatus, raw } = diagnoseGeminiError(error);
  if (httpStatus === 403 || httpStatus === 401 || httpStatus === 400 || httpStatus === 404) return false;
  if (httpStatus === 429 || (httpStatus !== null && httpStatus >= 500)) return true;
  if (httpStatus !== null) return false;
  return /failed to fetch|networkerror|econnreset|etimedout|load failed/i.test(raw);
}

function toReadableGeminiError(error: unknown): Error {
  const { httpStatus, apiMessage } = diagnoseGeminiError(error);

  if (httpStatus === 403) {
    return new Error(
      `Gemini API access denied (403). Google blocked this API key/project (billing paused, restricted region, abuse flag, or “denied access”). ` +
        `Fix: https://aistudio.google.com/apikey — create a new key, confirm the Gemini / Generative Language API is enabled for that Google Cloud project, ` +
        `link billing if Google requires it, set server-only GEMINI_API_KEY on your API deployment, redeploy. Google said: ${apiMessage}`
    );
  }
  if (httpStatus === 401) {
    return new Error(`Gemini rejected the server API key (401). Check GEMINI_API_KEY. Details: ${apiMessage}`);
  }
  if (httpStatus === 429) {
    return new Error(`Gemini quota / rate limited (429). Wait and retry, or raise quota. Details: ${apiMessage}`);
  }

  return error instanceof Error ? error : new Error(String(error));
}

/** Max completion tokens for document JSON (large multi-invoice PDFs need headroom; override with VITE_GEMINI_MAX_OUTPUT_TOKENS). */
function resolveMaxOutputTokens(defaultTokens = 32768): number {
  const env = import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS?.trim();
  const n = env ? Number(env) : NaN;
  if (!Number.isNaN(n) && n >= 2048) return Math.min(n, 65536);
  return defaultTokens;
}

/** Strip ```json fences if the model wraps JSON. */
function stripJsonMarkdownFence(raw: string): string {
  let t = raw.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/im.exec(t);
  if (fenced) return fenced[1].trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

/** Extract outermost `{...}` using string-aware brace counting (ignores braces inside strings). */
function extractBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse Gemini JSON output: handle fences, stray prose, and mildly corrupted boundaries.
 * Throws SyntaxError so withRetry can rerun the request when output was truncated.
 */
function parseModelJsonResponse<T>(raw: string | undefined | null, label: string): T {
  if (raw == null || String(raw).trim() === "") {
    throw new SyntaxError(`Empty model response (${label})`);
  }
  const cleaned = stripJsonMarkdownFence(String(raw));
  const candidates: string[] = [cleaned];
  const balanced = extractBalancedJsonObject(cleaned);
  if (balanced && balanced !== cleaned) candidates.push(balanced);

  let lastErr: unknown;
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new SyntaxError(
    `Invalid JSON from model (${label}): ${msg}. Preview: ${cleaned.slice(0, 320).replace(/\s+/g, " ")}`
  );
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> => {
  try {
    return await fn();
  } catch (error: unknown) {
    if (retries > 0 && geminiErrorIsRetryable(error)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    throw toReadableGeminiError(error);
  }
};

export const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

async function generateGeminiForDocumentFile(
  file: File,
  storageRef: DocumentStorageRef | null,
  promptText: string,
  model: string,
  config?: unknown
): Promise<{ text: string }> {
  if (storageRef) {
    return generateGeminiContentFromStorage({
      model,
      storagePath: storageRef.storagePath,
      fileUrl: storageRef.downloadURL,
      mimeType: storageRef.mimeType,
      contents: { parts: [{ text: promptText }] },
      config,
    });
  }

  const prepared = await prepareDocumentForAi(file);
  const base64 = await fileToBase64(prepared);
  const mimeType = prepared.type || file.type;
  return generateGeminiContent({
    model,
    contents: {
      parts: [{ inlineData: { mimeType, data: base64 } }, { text: promptText }],
    },
    config,
  });
}

export const getLiveExchangeRate = async (from: string, to: string): Promise<number> => {
  if (!from || from === to || from === '---') return 1.0;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    return data.rates[to] || 1.0;
  } catch (e) {
    return 1.0;
  }
};

type ExhaustiveInvoicePass = {
  detectedInvoiceCount?: number;
  subDocuments?: Array<{
    pageRange?: string;
    issuer?: string;
    date?: string;
    totalAmount?: number;
    originalCurrency?: string;
    documentType?: string;
    expenseCategory?: string;
    vatAmount?: number;
    vatRate?: number;
    netAmount?: number;
  }>;
  lineItems?: BankTransaction[];
};

async function extractInvoiceBreakdownExhaustive(
  file: File,
  storageRef: DocumentStorageRef | null,
  mimeType: string,
  model: string,
  userHint?: string
): Promise<ExhaustiveInvoicePass | null> {
  const hintSection = userHint ? `USER HINT: "${userHint}".` : "";
  const promptText = `You are auditing a multi-page PDF that may contain MULTIPLE separate invoices or receipts bound together.
${hintSection}

MANDATORY:
1. Read EVERY page from first to last. Never assume a single invoice.
2. Return one subDocuments entry per DISTINCT invoice/receipt (different issuer, invoice number, or dated block).
3. NEVER stop after the first page or first two invoices.
4. If one invoice spans multiple pages, merge into ONE entry with pageRange like "3-4".
5. Extract per-invoice: issuer (supplier name), invoice/reference number if visible (append to issuer as "Name | Ref 12345"), date, pageRange, originalCurrency, netAmount, vatAmount, vatRate, totalAmount (gross including VAT).
6. lineItems: one EXPENSE row per sub-invoice (amount = that invoice gross total, description = issuer + pages).
7. After extraction, verify detectedInvoiceCount matches len(subDocuments); if not, fix before returning.
8. JSON only: no raw newlines or unescaped " inside strings; keep descriptions short.
9. DISTINCT-INVOICE RULE: invoices with different dates/page blocks are separate entries, even if supplier and amounts look similar.

Return JSON only matching schema.`;

  const exhaustiveConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedInvoiceCount: { type: Type.NUMBER },
            subDocuments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageRange: { type: Type.STRING },
                  issuer: { type: Type.STRING },
                  date: { type: Type.STRING },
                  totalAmount: { type: Type.NUMBER },
                  originalCurrency: { type: Type.STRING },
                  documentType: { type: Type.STRING },
                  expenseCategory: { type: Type.STRING },
                  vatAmount: { type: Type.NUMBER },
                  vatRate: { type: Type.NUMBER },
                  netAmount: { type: Type.NUMBER },
                },
                required: ["issuer", "totalAmount", "originalCurrency", "expenseCategory"]
              }
            },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING }
                },
                required: ["description", "amount", "type", "category"]
              }
            }
          }
        },
        temperature: 0.05,
        topP: 0.9,
        topK: 20,
        maxOutputTokens: resolveMaxOutputTokens(24576),
      };

  try {
    const response = await generateGeminiForDocumentFile(
      file,
      storageRef,
      promptText,
      model,
      exhaustiveConfig
    );

    const parsed = parseModelJsonResponse<ExhaustiveInvoicePass>(response.text, "exhaustive-invoice-pass");
    return parsed;
  } catch (error) {
    console.warn('Exhaustive invoice pass failed:', error);
    return null;
  }
}

/** When multiple invoices exist, force header totals to equal the sum of each sub-invoice (gross/VAT/net). */
function syncGrandTotalsFromSubDocuments(data: FinancialData): FinancialData {
  const subs = Array.isArray(data.subDocuments) ? data.subDocuments : [];
  if (subs.length < 2) return data;

  const gross =
    Math.round(subs.reduce((s, x: FinancialData) => s + Number(x.totalAmount || 0), 0) * 100) / 100;
  const vat =
    Math.round(subs.reduce((s, x: FinancialData) => s + Number(x.vatAmount || 0), 0) * 100) / 100;
  const net =
    Math.round(subs.reduce((s, x: FinancialData) => s + Number(x.netAmount || 0), 0) * 100) / 100;
  const rate = Number(data.conversionRateUsed ?? 1) || 1;
  const amountInCHF = Math.round(gross * rate * 100) / 100;

  const note = `Grand total (${subs.length} invoices): ${gross} ${data.originalCurrency || 'CHF'}.`;
  const interp = data.aiInterpretation?.includes('Grand total') ? data.aiInterpretation : `${data.aiInterpretation || ''} ${note}`.trim();

  return {
    ...data,
    totalAmount: gross,
    vatAmount: vat,
    netAmount: net,
    amountInCHF,
    aiInterpretation: interp,
  };
}

/** True when this extraction should be treated as a Swiss payslip (never split like multi-invoice PDFs). */
function isPaySlipFinancialData(data: FinancialData, file?: File): boolean {
  const dt = String(data.documentType ?? "");
  if (dt === DocumentType.PAY_SLIP) return true;
  if (/pay\s*slip|payslip|bulletin\s+de\s+salaire|fiche\s+de\s+paie|lohnabrechnung|gehaltsabrechnung/i.test(dt)) return true;
  const ps = data.paySlip;
  if (ps && typeof ps === "object" && (Boolean(ps.employee?.name) || Boolean(ps.employer?.name))) return true;
  const n = (file?.name || "").toLowerCase();
  if (/(salaire|bulletin|payslip|pay[\s_-]*slip|fiche[\s_-]*paie|lohn|gehalt)/i.test(n)) return true;
  return false;
}

/**
 * Gemini sometimes emits 2+ subDocuments for a single payslip (duplicate "invoices"). Collapse to one payroll line
 * and clear subDocuments so rollups match the printed salary once.
 */
function repairPaySlipMultiInvoiceBlocks(data: FinancialData, file?: File): FinancialData {
  if (!isPaySlipFinancialData(data, file)) return data;

  const ps = data.paySlip;
  const subs = Array.isArray(data.subDocuments) ? data.subDocuments : [];
  const badIssuer = /\d+\s*invoices?\s*detected/i.test(String(data.issuer ?? ""));
  if (subs.length <= 1 && !badIssuer) {
    if (badIssuer && ps?.employer?.name) {
      return { ...data, issuer: sanitizeLooseText(ps.employer.name, 120) };
    }
    return data;
  }

  const gross = toFiniteNumber(ps?.grossPay, 0);
  const net = toFiniteNumber(ps?.netPay, 0);
  const sumSubGross = subs.reduce((s, x) => s + toFiniteNumber(x.totalAmount, 0), 0);

  let headerGross = gross > 0 ? gross : toFiniteNumber(data.totalAmount, 0);
  if (subs.length >= 2 && gross > 0 && Math.abs(sumSubGross - 2 * gross) < Math.max(2, gross * 0.02)) {
    headerGross = gross;
  } else if (subs.length >= 2 && gross <= 0 && net > 0 && Math.abs(sumSubGross - 2 * net) < Math.max(2, net * 0.02)) {
    headerGross = sumSubGross / 2;
  } else if (subs.length >= 2 && headerGross > 0 && Math.abs(sumSubGross - 2 * headerGross) < Math.max(2, headerGross * 0.02)) {
    headerGross = headerGross;
  } else if (subs.length >= 2 && sumSubGross > 0) {
    const first = toFiniteNumber(subs[0]?.totalAmount, 0);
    const allSame = subs.every((x) => Math.abs(toFiniteNumber(x.totalAmount, 0) - first) < 0.05);
    headerGross = allSame && first > 0 ? first : sumSubGross / subs.length;
  }

  const headerNet = net > 0 ? net : toFiniteNumber(data.netAmount, 0);
  const employer = ps?.employer?.name
    ? sanitizeLooseText(ps.employer.name, 120)
    : sanitizeLooseText(String(data.issuer || "").replace(/^\d+\s*invoices?\s*detected\s*/i, "").trim(), 120) ||
      sanitizeLooseText(data.issuer, 120);
  const empName = ps?.employee?.name ? sanitizeLooseText(ps.employee.name, 120) : "Employee";
  const payDate = sanitizeLooseText(data.date, 24) || sanitizeLooseText(ps?.periodEnd, 24) || new Date().toISOString().slice(0, 10);

  const amount = Math.round((headerGross > 0 ? headerGross : sumSubGross) * 100) / 100;
  const lineItem: BankTransaction = {
    date: payDate,
    description: `Payslip - ${empName}`,
    amount,
    type: "EXPENSE",
    category: "PAYROLL",
    notes: sanitizeLooseText(`Net pay ${headerNet} ${data.originalCurrency || "CHF"}`, 220),
  };

  const note = sanitizeLooseText(
    `Single payslip merged (${subs.length} duplicate blocks removed). ${data.aiInterpretation || ""}`,
    380
  );

  const permitType = ps?.permitType ?? "B";
  return applyPayrollPaymentFields({
    ...data,
    documentType: DocumentType.PAY_SLIP,
    subDocuments: [],
    issuer: employer || data.issuer,
    totalAmount: amount,
    netAmount: headerNet,
    vatAmount: 0,
    expenseCategory: "PAYROLL",
    payrollSettlementMode: data.payrollSettlementMode ?? (permitType === "C" || permitType === "CH" ? "gross_paid" : "source_tax"),
    paySlip: {
      ...(ps ?? { employee: { name: empName }, employer: { name: employer } }),
      permitType,
      grossPay: amount,
      netPay: headerNet,
      paymentToEmployee: ps?.paymentToEmployee,
    },
    lineItems: [lineItem],
    aiInterpretation: note,
  });
}

function normalizeMultiInvoiceData(parsed: FinancialData): FinancialData {
  const subDocs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments : [];
  const normalizedLineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];

  // Build stable line items from each detected sub-invoice so analysis table is always populated.
  const generatedLineItems: BankTransaction[] = subDocs.map((sub: any) => ({
    date: sub.date || parsed.date || new Date().toISOString().slice(0, 10),
    description: `${sub.issuer || 'Unknown issuer'}${sub.pageRange ? ` (pages ${sub.pageRange})` : ''}`,
    amount: Number(sub.totalAmount || 0),
    type: 'EXPENSE',
    category: sub.expenseCategory || 'OTHER',
    notes: `VAT ${Number(sub.vatRate || 0)}% | VAT Amount ${Number(sub.vatAmount || 0)} ${sub.originalCurrency || parsed.originalCurrency || 'CHF'}`
  }));

  // If model under-fills subDocuments (single-invoice case), derive additional blocks from expense lines.
  // For true multi-invoice documents, never infer from product-level lines because it inflates totals.
  const inferredSubDocsFromLineItems = (subDocs.length <= 1 ? normalizedLineItems : [])
    .filter((item) => item.type === 'EXPENSE' && Number(item.amount || 0) > 0)
    .map((item) => ({
      pageRange: '',
      issuer: item.description || 'Unknown issuer',
      date: item.date || parsed.date || new Date().toISOString().slice(0, 10),
      totalAmount: Number(item.amount || 0),
      originalCurrency: parsed.originalCurrency || 'CHF',
      documentType: 'TICKET/RECEIPT',
      expenseCategory: item.category || parsed.expenseCategory || 'OTHER',
      vatAmount: 0,
      vatRate: 0,
      netAmount: Number(item.amount || 0),
    }));

  const mergedSubDocs = [...subDocs];
  const seen = new Set(
    subDocs.map((s: any) => `${s.issuer || ''}|${s.date || ''}|${Number(s.totalAmount || 0).toFixed(2)}`)
  );
  for (const inferred of inferredSubDocsFromLineItems) {
    const signature = `${inferred.issuer}|${inferred.date}|${Number(inferred.totalAmount || 0).toFixed(2)}`;
    if (!seen.has(signature)) {
      mergedSubDocs.push(inferred as any);
      seen.add(signature);
    }
  }

  if (mergedSubDocs.length === 0) return parsed;

  // Per-invoice amount consistency + aggregate totals must match SUM(sub-invoices).
  const repairedSubs = mergedSubDocs.map((sub: any) => {
    let total = Number(sub.totalAmount ?? 0);
    let net = Number(sub.netAmount ?? 0);
    let vat = Number(sub.vatAmount ?? 0);
    if (total <= 0 && net + vat > 0) total = net + vat;
    else if (Math.abs(total - (net + vat)) > 0.03 && net + vat > 0) {
      total = Math.round((net + vat) * 100) / 100;
    } else if (total > 0 && net <= 0 && vat >= 0 && vat <= total) net = Math.round((total - vat) * 100) / 100;
    return { ...sub, totalAmount: total, netAmount: net, vatAmount: vat };
  });

  let subTotal = repairedSubs.reduce((sum: number, sub: any) => sum + Number(sub.totalAmount || 0), 0);
  const subVat = repairedSubs.reduce((sum: number, sub: any) => sum + Number(sub.vatAmount || 0), 0);
  const subNet = repairedSubs.reduce((sum: number, sub: any) => sum + Number(sub.netAmount || 0), 0);

  const rebasedItems: BankTransaction[] = repairedSubs.map((sub: any) => ({
    date: sub.date || parsed.date || new Date().toISOString().slice(0, 10),
    description: `${sub.issuer || 'Unknown issuer'}${sub.pageRange ? ` (pages ${sub.pageRange})` : ''}`,
    amount: Number(sub.totalAmount || 0),
    type: 'EXPENSE',
    category: sub.expenseCategory || 'OTHER',
    notes: `VAT ${Number(sub.vatRate || 0)}% | VAT Amount ${Number(sub.vatAmount || 0)} ${sub.originalCurrency || parsed.originalCurrency || 'CHF'}`,
  }));

  const expenseSumGenerated = rebasedItems
    .filter((i) => i.type === 'EXPENSE')
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const lineSumMatch =
    normalizedLineItems.length === rebasedItems.length &&
    Math.abs(expenseSumGenerated - normalizedLineItems.filter((i) => i.type === 'EXPENSE').reduce((s, i) => s + Number(i.amount || 0), 0)) < 1;

  const finalLineItems =
    repairedSubs.length > 1
      ? rebasedItems
      : normalizedLineItems.length > 0 && lineSumMatch && normalizedLineItems.length >= repairedSubs.length
        ? normalizedLineItems
        : rebasedItems;

  const rollupFromLines = finalLineItems
    .filter((i) => i.type === 'EXPENSE')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  /** For multi-invoice documents, grand total is ALWAYS the sum of invoice-level gross totals. */
  const aggregatedTotal =
    repairedSubs.length > 1
      ? subTotal
      : rollupFromLines > 0 && Math.abs(subTotal - rollupFromLines) > 0.06
        ? rollupFromLines
        : subTotal;
  const aggregatedVat = repairedSubs.reduce((sum: number, sub: any) => sum + Number(sub.vatAmount || 0), 0);
  const aggregatedNet = repairedSubs.reduce((sum: number, sub: any) => sum + Number(sub.netAmount || 0), 0);

  const sortedDates = repairedSubs.map((s: any) => s.date).filter(Boolean).sort();

  return {
    ...parsed,
    subDocuments: repairedSubs as any,
    totalAmount: aggregatedTotal,
    vatAmount: aggregatedVat,
    netAmount: aggregatedNet,
    issuer:
      repairedSubs.length > 1 ? `${repairedSubs.length} invoices detected` : parsed.issuer || repairedSubs[0]?.issuer || 'Unknown',
    lineItems: finalLineItems,
    date: (sortedDates[0] as string) || parsed.date,
    aiInterpretation: parsed.aiInterpretation || `Detected ${repairedSubs.length} invoice blocks across all pages.`,
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeLooseText(value: unknown, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function coerceDocumentType(value: unknown): DocumentType {
  const normalized = sanitizeLooseText(value, 60);
  const validValues = Object.values(DocumentType) as string[];
  return (validValues.includes(normalized) ? normalized : DocumentType.UNKNOWN) as DocumentType;
}

function roundSwiss2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeSwissVatFormPreview(expenseCategory: string, merchandise: number, vatTotal: number): SwissVatFormPreview {
  const cat = (expenseCategory || "").toUpperCase();
  const isRevenue =
    cat.includes("REVENUE") || cat.includes("SALES") || cat.includes("RESERVATION") || cat.includes("INCOME");
  const r200 = roundSwiss2(merchandise);
  const r220 = isRevenue ? roundSwiss2(vatTotal) : 0;
  const r400 = isRevenue ? 0 : roundSwiss2(vatTotal);
  const r500 = roundSwiss2(r220 - r400);
  return { code200: r200, code220: r220, code400: r400, code500: r500 };
}

/** Recompute header amounts, receipt totals coherence, and form-code preview from Swiss TVA rows + optional receipt row overrides. */
export function syncSwissVatDerivedFields(data: FinancialData): FinancialData {
  const lines = Array.isArray(data.swissVatBreakdown) ? [...data.swissVatBreakdown] : [];
  const sumVat = lines.reduce((s, l) => s + roundSwiss2(toFiniteNumber(l.vatAmount, 0)), 0);
  const sumBase = lines.reduce((s, l) => s + roundSwiss2(toFiniteNumber(l.baseExclusive, 0)), 0);
  const rt = data.swissVatReceiptTotals || {};
  const merchandise =
    rt.merchandiseSubtotal != null && Number.isFinite(Number(rt.merchandiseSubtotal))
      ? roundSwiss2(Number(rt.merchandiseSubtotal))
      : sumBase;
  const vatTotal =
    lines.length > 0
      ? sumVat
      : rt.vatTotal != null && Number.isFinite(Number(rt.vatTotal))
        ? roundSwiss2(Number(rt.vatTotal))
        : sumVat;
  const deposit =
    rt.deposit != null && Number.isFinite(Number(rt.deposit)) ? roundSwiss2(Number(rt.deposit)) : 0;
  const totalIncl =
    rt.totalInclVat != null && Number.isFinite(Number(rt.totalInclVat))
      ? roundSwiss2(Number(rt.totalInclVat))
      : roundSwiss2(merchandise + vatTotal + deposit);
  const form = computeSwissVatFormPreview(data.expenseCategory || "", merchandise, vatTotal);
  const rate = Number(data.conversionRateUsed ?? 1) || 1;
  const amountInCHF = rate !== 1 ? roundSwiss2(totalIncl * rate) : totalIncl;
  return {
    ...data,
    swissVatBreakdown: lines.length > 0 ? lines : undefined,
    swissVatReceiptTotals: {
      merchandiseSubtotal: merchandise,
      vatTotal,
      deposit,
      totalInclVat: totalIncl,
    },
    swissVatFormPreview: form,
    vatAmount: vatTotal,
    netAmount: merchandise,
    totalAmount: totalIncl,
    amountInCHF,
  };
}

function sanitizeSwissVatFields(
  source: Partial<FinancialData>,
  expenseCategoryFallback: string
): Pick<FinancialData, "swissVatBreakdown" | "swissVatReceiptTotals" | "swissVatFormPreview" | "vatRate"> {
  const cat = sanitizeLooseText(source.expenseCategory || expenseCategoryFallback, 80) || "OTHER";
  const linesRaw = Array.isArray(source.swissVatBreakdown) ? source.swissVatBreakdown : [];
  const lines: SwissVatRateLine[] = linesRaw
    .map((l) => ({
      ratePercent: Math.round(toFiniteNumber((l as SwissVatRateLine).ratePercent, 0) * 1000) / 1000,
      baseExclusive: roundSwiss2(toFiniteNumber((l as SwissVatRateLine).baseExclusive, 0)),
      vatAmount: roundSwiss2(toFiniteNumber((l as SwissVatRateLine).vatAmount, 0)),
    }))
    .filter((l) => Number.isFinite(l.ratePercent));

  const rt = source.swissVatReceiptTotals;
  let receipt: SwissVatReceiptTotals | undefined;
  if (rt && typeof rt === "object") {
    const m = roundSwiss2(toFiniteNumber(rt.merchandiseSubtotal, 0));
    const v = roundSwiss2(toFiniteNumber(rt.vatTotal, 0));
    const d = roundSwiss2(toFiniteNumber(rt.deposit, 0));
    const t = roundSwiss2(toFiniteNumber(rt.totalInclVat, 0));
    if (m !== 0 || v !== 0 || d !== 0 || t !== 0) {
      receipt = { merchandiseSubtotal: m, vatTotal: v, deposit: d, totalInclVat: t };
    }
  }

  const vatR = toFiniteNumber(source.vatRate, 0);
  const vatRateOut = vatR > 0 ? Math.round(vatR * 1000) / 1000 : undefined;

  const sumVat = lines.reduce((s, l) => s + l.vatAmount, 0);
  const sumBase = lines.reduce((s, l) => s + l.baseExclusive, 0);
  const merch =
    receipt && receipt.merchandiseSubtotal != null && receipt.merchandiseSubtotal > 0
      ? receipt.merchandiseSubtotal
      : sumBase;
  const vatTot = lines.length > 0 ? sumVat : receipt?.vatTotal ?? sumVat;
  const form =
    lines.length > 0 || (receipt && (receipt.merchandiseSubtotal || receipt.vatTotal || receipt.totalInclVat))
      ? computeSwissVatFormPreview(cat, merch, vatTot)
      : undefined;

  return {
    vatRate: vatRateOut,
    swissVatBreakdown: lines.length > 0 ? lines : undefined,
    swissVatReceiptTotals: receipt,
    swissVatFormPreview: form,
  };
}

function sanitizeFinancialDataForUi(data: FinancialData): FinancialData {
  const safeLineItems: BankTransaction[] = (Array.isArray(data.lineItems) ? data.lineItems : [])
    .map((item) => {
      const amount = toFiniteNumber(item?.amount, 0);
      return {
        date: sanitizeLooseText(item?.date, 24),
        description: sanitizeLooseText(item?.description, 220) || 'Unlabeled line item',
        amount,
        type: (item?.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
        category: sanitizeLooseText(item?.category, 80) || 'OTHER',
        notes: sanitizeLooseText((item as any)?.notes, 220),
        isHumanVerified: Boolean((item as any)?.isHumanVerified),
      };
    })
    .filter((item) => item.amount >= 0);

  const rootSwiss = sanitizeSwissVatFields(data, data.expenseCategory || "OTHER");

  const safeSubDocuments: FinancialData[] = (Array.isArray(data.subDocuments) ? data.subDocuments : [])
    .map((sub) => {
      const subCat = sanitizeLooseText(sub?.expenseCategory, 80) || data.expenseCategory || "OTHER";
      const baseSub = {
        ...sub,
        pageRange: sanitizeLooseText((sub as any)?.pageRange, 40),
        date: sanitizeLooseText(sub?.date, 24),
        issuer: sanitizeLooseText(sub?.issuer, 120) || "Unknown issuer",
        originalCurrency: sanitizeLooseText(sub?.originalCurrency, 10) || data.originalCurrency || "CHF",
        documentType: coerceDocumentType(sub?.documentType),
        expenseCategory: subCat || "OTHER",
        totalAmount: toFiniteNumber(sub?.totalAmount, 0),
        vatAmount: toFiniteNumber(sub?.vatAmount, 0),
        netAmount: toFiniteNumber(sub?.netAmount, 0),
        aiInterpretation: sanitizeLooseText(sub?.aiInterpretation, 320),
      } as FinancialData;
      return { ...baseSub, ...sanitizeSwissVatFields(baseSub, subCat) };
    })
    .filter((sub) => toFiniteNumber(sub.totalAmount, 0) >= 0);

  return {
    ...data,
    documentType: coerceDocumentType(data.documentType),
    date: sanitizeLooseText(data.date, 24),
    issuer: sanitizeLooseText(data.issuer, 120) || "Unknown issuer",
    documentNumber: sanitizeLooseText(data.documentNumber, 80),
    originalCurrency: sanitizeLooseText(data.originalCurrency, 10) || "CHF",
    expenseCategory: sanitizeLooseText(data.expenseCategory, 80) || "OTHER",
    notes: sanitizeLooseText(data.notes, 280),
    aiInterpretation: sanitizeLooseText(data.aiInterpretation, 380),
    totalAmount: toFiniteNumber(data.totalAmount, 0),
    vatAmount: toFiniteNumber(data.vatAmount, 0),
    netAmount: toFiniteNumber(data.netAmount, 0),
    amountInCHF: toFiniteNumber(data.amountInCHF, 0),
    confidenceScore: toFiniteNumber(data.confidenceScore, 0),
    conversionRateUsed: toFiniteNumber(data.conversionRateUsed, 1),
    openingBalance: toFiniteNumber(data.openingBalance, 0),
    finalBalance: toFiniteNumber(data.finalBalance, 0),
    calculatedTotalIncome: toFiniteNumber(data.calculatedTotalIncome, 0),
    calculatedTotalExpense: toFiniteNumber(data.calculatedTotalExpense, 0),
    forensicAlerts: (Array.isArray(data.forensicAlerts) ? data.forensicAlerts : [])
      .map((msg) => sanitizeLooseText(msg, 180))
      .filter(Boolean),
    lineItems: safeLineItems,
    subDocuments: safeSubDocuments,
    ...rootSwiss,
  };
}

function shouldRunExhaustivePdfPass(file: File, parsed: FinancialData, userHint?: string): boolean {
  if (isPaySlipFinancialData(parsed, file)) return false;

  const hint = (userHint || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const hasMultiHint =
    hint.includes('multi') ||
    hint.includes('bulk') ||
    hint.includes('all pages') ||
    hint.includes('several') ||
    hint.includes('multiple invoice') ||
    name.includes('multi') ||
    name.includes('bulk') ||
    name.includes('z2');

  const extractedSubDocs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments.length : 0;
  const docType = String(parsed.documentType ?? '');

  const expenseBundle =
    docType === DocumentType.INVOICE ||
    docType === DocumentType.RECEIPT ||
    docType === DocumentType.UNKNOWN ||
    docType === 'Invoice' ||
    docType === 'Ticket/Receipt' ||
    docType === 'Unknown';

  const lineCount = Array.isArray(parsed.lineItems) ? parsed.lineItems.length : 0;
  const suspiciousUnderSplit = extractedSubDocs <= 1 && lineCount >= 4;

  return (
    hasMultiHint ||
    extractedSubDocs > 1 ||
    extractedSubDocs === 0 ||
    expenseBundle ||
    suspiciousUnderSplit
  );
}

function applySwissVatWarnings(data: FinancialData): FinancialData {
  let dataIn = { ...data };
  const lines = Array.isArray(dataIn.swissVatBreakdown) ? dataIn.swissVatBreakdown : [];
  const sumLineVat = lines.reduce((s, l) => s + roundSwiss2(toFiniteNumber(l.vatAmount, 0)), 0);
  if (lines.length > 0 && sumLineVat > 0.004 && Number(dataIn.vatAmount || 0) <= 0.004) {
    dataIn = syncSwissVatDerivedFields(dataIn);
  }

  const subDocsRaw = Array.isArray(dataIn.subDocuments) ? dataIn.subDocuments : [];
  const subDocsSynced = subDocsRaw.map((sub) => {
    const sl = Array.isArray(sub.swissVatBreakdown) ? sub.swissVatBreakdown : [];
    const sv = sl.reduce((s, l) => s + roundSwiss2(toFiniteNumber(l.vatAmount, 0)), 0);
    if (sl.length > 0 && sv > 0.004 && Number(sub.vatAmount || 0) <= 0.004) {
      return syncSwissVatDerivedFields({
        ...sub,
        conversionRateUsed: Number(sub as any).conversionRateUsed || dataIn.conversionRateUsed || 1,
      } as FinancialData);
    }
    return sub;
  });
  dataIn = { ...dataIn, subDocuments: subDocsSynced };

  const alerts = new Set(Array.isArray(dataIn.forensicAlerts) ? dataIn.forensicAlerts : []);
  const subDocs = Array.isArray(dataIn.subDocuments) ? dataIn.subDocuments : [];
  const noVatAtHeader = Number(dataIn.totalAmount || 0) > 0 && Number(dataIn.vatAmount || 0) <= 0;
  if (noVatAtHeader) {
    alerts.add(
      'Swiss TVA warning: This document has TVA = 0. Verify exemption status or complete VAT fields before filing.'
    );
  }

  let missingSubVatCount = 0;
  for (const sub of subDocs) {
    const hasValue = Number(sub.totalAmount || 0) > 0;
    const missingVat = Number(sub.vatAmount || 0) <= 0;
    if (hasValue && missingVat) missingSubVatCount += 1;
  }
  if (missingSubVatCount > 0) {
    alerts.add(
      `Swiss TVA warning: ${missingSubVatCount} extracted supplier document block(s) have 0 TVA. Validate exemption reason or correct VAT fields.`
    );
  }

  const withComputedRates = subDocs.map((sub) => {
    const vatAmount = Number(sub.vatAmount || 0);
    const netAmount = Number(sub.netAmount || 0);
    const existingRate = Number((sub as any).vatRate || 0);
    const inferredRate = netAmount > 0 && vatAmount > 0 ? Math.round((vatAmount / netAmount) * 10000) / 100 : 0;
    return { ...sub, vatRate: existingRate > 0 ? existingRate : inferredRate } as any;
  });

  const interpreted = dataIn.aiInterpretation || '';
  const interpretationWithVatHint =
    alerts.size > 0 && !/tva warning|vat warning/i.test(interpreted)
      ? `${interpreted} TVA warning: validate zero-VAT entries before Swiss filing.`.trim()
      : interpreted;

  return {
    ...dataIn,
    subDocuments: withComputedRates as any,
    forensicAlerts: Array.from(alerts),
    aiInterpretation: interpretationWithVatHint,
  };
}


export const analyzeFinancialDocument = async (
  file: File,
  targetCurrency: string = 'CHF',
  userHint?: string,
  existingStorage?: { fileUrl?: string; storagePath?: string }
): Promise<FinancialData> => {
  const storageRef = await ensureDocumentStorageForAi(file, existingStorage);
  const model = resolveDocumentModel();
  const mimeType = storageRef?.mimeType || file.type || 'application/octet-stream';

  console.log(
    `📄 Analyzing: ${file.name} (${(file.size / 1024).toFixed(2)} KB)` +
      (storageRef ? ' via Firebase Storage' : '')
  );

  return withRetry(async () => {
    console.log(`🤖 Calling Gemini API...`);
    const startTime = Date.now();
    
    const coreSchema: any = {
      type: Type.OBJECT,
      properties: {
        documentType: {
          type: Type.STRING,
          enum: ["Bank Statement", "Pay Slip", "Invoice", "Ticket/Receipt", "Z2 Multi-Ticket Sheet", "Bank Deposit", "Unknown"],
          description: "Document type classification"
        },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        issuer: { type: Type.STRING, description: "Primary entity name" },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER, description: "Total amount INCLUDING VAT" },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER, description: "VAT/Tax amount. Set to 0 if not found." },
        vatRate: { type: Type.NUMBER, description: "VAT rate %. Set to 0 if not found." },
        netAmount: { type: Type.NUMBER, description: "Amount BEFORE VAT" },
        expenseCategory: { 
          type: Type.STRING,
          description: "Specific category based on issuer"
        },
        amountInCHF: { type: Type.NUMBER },
        notes: { type: Type.STRING },
        aiInterpretation: { type: Type.STRING, description: "Brief scan result" },
        confidenceScore: { type: Type.NUMBER },
        forensicAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
        swissVatBreakdown: {
          type: Type.ARRAY,
          description:
            "Swiss cash-register / receipt TVA table: one entry per VAT rate column (e.g. 0%, 2.6%, 8.1%) with HT base (exclusive) and TVA amount exactly as printed.",
          items: {
            type: Type.OBJECT,
            properties: {
              ratePercent: { type: Type.NUMBER, description: "VAT % for this column (0, 2.6, 8.1, etc.)" },
              baseExclusive: { type: Type.NUMBER, description: "HT base amount (du XXX) for this rate" },
              vatAmount: { type: Type.NUMBER, description: "TVA amount for this column" },
            },
            required: ["ratePercent", "baseExclusive", "vatAmount"],
          },
        },
        swissVatReceiptTotals: {
          type: Type.OBJECT,
          description: "Receipt totals row: Total marchandise (HT), Total TVA, Dépôt, Total CHF TTC",
          properties: {
            merchandiseSubtotal: { type: Type.NUMBER },
            vatTotal: { type: Type.NUMBER },
            deposit: { type: Type.NUMBER },
            totalInclVat: { type: Type.NUMBER },
          },
        },
        openingBalance: { type: Type.NUMBER },
        finalBalance: { type: Type.NUMBER },
        calculatedTotalIncome: { type: Type.NUMBER },
        calculatedTotalExpense: { type: Type.NUMBER },
        paySlip: {
          type: Type.OBJECT,
          description: "Populate ONLY for Pay Slips",
          properties: {
            employee: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                idNumber: { type: Type.STRING },
                address: { type: Type.STRING },
              },
              required: ["name"],
            },
            employer: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                idNumber: { type: Type.STRING },
                address: { type: Type.STRING },
              },
              required: ["name"],
            },
            payslipNumber: { type: Type.STRING },
            periodStart: { type: Type.STRING },
            periodEnd: { type: Type.STRING },
            payDate: { type: Type.STRING },
            currency: { type: Type.STRING },
            grossPay: { type: Type.NUMBER },
            netPay: { type: Type.NUMBER },
            paymentToEmployee: {
              type: Type.NUMBER,
              description:
                "Actual bank Payment/Remittance to employee (after advance on salary if shown). Not the printed net before advance.",
            },
            components: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING },
                },
                required: ["date", "description", "amount", "type", "category"],
              },
            },
          },
        },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING }
            }
          }
        },
        subDocuments: {
          type: Type.ARRAY,
          description: "MANDATORY for multi-page/multi-invoice PDFs: one entry per detected invoice/receipt/document block across ALL pages.",
          items: {
            type: Type.OBJECT,
            properties: {
              pageRange: { type: Type.STRING, description: "Page or page range where this sub-document appears, e.g. '1', '2-3'" },
              issuer: { type: Type.STRING },
              date: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              originalCurrency: { type: Type.STRING },
              documentType: { type: Type.STRING, enum: ["VOUCHER", "TICKET/RECEIPT", "BANK_DEPOSIT"] },
              expenseCategory: { type: Type.STRING },
              vatAmount: { type: Type.NUMBER },
              vatRate: { type: Type.NUMBER },
              netAmount: { type: Type.NUMBER },
              swissVatBreakdown: {
                type: Type.ARRAY,
                description: "Per-invoice Swiss multi-rate TVA columns when visible on that block.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ratePercent: { type: Type.NUMBER },
                    baseExclusive: { type: Type.NUMBER },
                    vatAmount: { type: Type.NUMBER },
                  },
                  required: ["ratePercent", "baseExclusive", "vatAmount"],
                },
              },
              swissVatReceiptTotals: {
                type: Type.OBJECT,
                properties: {
                  merchandiseSubtotal: { type: Type.NUMBER },
                  vatTotal: { type: Type.NUMBER },
                  deposit: { type: Type.NUMBER },
                  totalInclVat: { type: Type.NUMBER },
                },
              },
            },
            required: ["pageRange", "issuer", "date", "totalAmount", "originalCurrency", "expenseCategory", "vatAmount", "vatRate", "netAmount"]
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "expenseCategory"]
    };

    const hintSection = userHint ? `USER HINT: "${userHint}".` : "";

    const analysisPrompt = `You are a strict Swiss accounting document extraction engine. ${hintSection}

CRITICAL RULES:
1. Identify document type accurately
2. Determine if this is INCOME (revenue, sales, deposits) or EXPENSE (bills, invoices to pay, purchases)
3. For INCOME documents: Set expenseCategory to "REVENUE" or "SALES"
4. For EXPENSE documents: Categorize specifically (e.g., "FOOD_SUPPLIES", "RENT", "UTILITIES")
5. Extract key financial data (amounts, dates, issuer)
6. For bank statements: extract ALL transactions into lineItems
7. For payslips: extract employee/employer info and components
8. Extract VAT if shown (TVA, VAT, MwSt, Tax labels)
9. For multi-document files (NOT pay slips): use subDocuments array — one entry per separate supplier invoice only
10. READ ALL PAGES of the PDF. Do not summarize only the first page.
11. If multiple invoices/receipts exist in one PDF, create one subDocuments entry per invoice/receipt with issuer, VAT, net, gross, currency, and pageRange.
12. If VAT is missing for a sub-document, set vatAmount=0 and vatRate=0 (never omit fields).
13. If one invoice spans multiple pages, merge those pages into ONE subDocuments entry with a combined pageRange (e.g. "2-3"), do not duplicate it.
14. For multi-invoice files, include lineItems with ONE row per invoice (gross total per invoice), not per product/ticket line.
15. NEVER cap extracted invoices to 2; include every invoice found across all pages.
16. Extract only values visible in the document. Never invent issuer names, dates, VAT, or totals.
17. If a required field is not visible, use safe defaults (empty string for text, 0 for numbers) and continue.
18. Prefer exact numeric copying from document totals over inferred arithmetic when both are present.
19. Keep sign consistency: INCOME amounts positive, EXPENSE amounts positive (classification carries direction).
20. Always return valid JSON that strictly matches the schema and contains no markdown/comments.
21. MULTI-INVOICE PDFs: If subDocuments has 2+ entries, top-level totalAmount MUST equal the sum of every subDocument.totalAmount (gross). Top-level vatAmount and netAmount MUST equal the sums of sub-invoice VAT and net respectively. Do not use only the first page total as the document total.
22. SINGLE PDF FILE: Even when the top-level documentType looks like one "Invoice", still scan the full PDF for multiple separate invoices and populate subDocuments accordingly.
23. JSON SAFETY: Output must be one valid JSON object only. Do not put raw line breaks or unescaped double-quotes inside string values. Keep aiInterpretation under 400 characters. Keep each lineItems[].description under 120 characters (abbreviate if needed). Escape any quote inside a string as backslash-quote.
24. DISTINCT-INVOICE RULE: Two visually similar invoices on different dates/pages are DISTINCT entries. Do not merge them unless they are clearly the same invoice continued across pages.
25. PHOTO MODE: If input is a smartphone photo/screenshot, first infer orientation, rotate mentally, then read all visible fields. Ignore background clutter, shadows, fingers, and perspective distortion.
26. OCR MODE: If text is partially unreadable, return best-effort values for readable fields and safe defaults for unreadable fields. Never invent amounts or names.
27. NUMBER SAFETY: Every numeric field must be a plain finite number (no currency symbols, commas, NaN, null, infinity, or strings).
28. STRING SAFETY: Keep all string fields concise, plain text, and free of control characters.
29. SWISS TVA ACCOUNTANT MODE: Extract TVA with accountant-level precision (TVA/VAT/MwSt labels), preserving values exactly as shown.
30. If an invoice/receipt appears taxable but no explicit TVA is found, set vatAmount=0 and add a short warning sentence in forensicAlerts.
31. For sales/revenue documents, TVA represents tax collected from clients. For supplier purchase documents, TVA represents input tax paid to suppliers.
32. SWISS TVA TABLE: If the document shows a multi-rate TVA block (columns like 0.00%, 2.60%, 8.10% with bases and TVA per column), populate swissVatBreakdown with one object per column (ratePercent, baseExclusive, vatAmount). Match printed numbers.
33. SWISS TOTALS ROW: If printed, set swissVatReceiptTotals.merchandiseSubtotal (Total marchandise HT), vatTotal (Total TVA), deposit (Dépôt), totalInclVat (Total CHF TTC). If unclear, derive totalInclVat = merchandiseSubtotal + vatTotal + deposit.
34. After filling swissVatBreakdown, set top-level vatAmount to the sum of column TVA amounts and netAmount to merchandise HT when available.
35. For each subDocuments entry that is a receipt/invoice with a printed multi-rate TVA grid, also populate that sub-entry's swissVatBreakdown and swissVatReceiptTotals when visible.
36. PAY SLIPS ONLY: documentType MUST be "Pay Slip". Set subDocuments to an empty array []. Never emit multiple subDocuments for one payslip — it is ONE document, not multiple invoices.
37. PAY SLIPS ONLY: Put totals in paySlip.grossPay, paySlip.netPay (printed net salary), paySlip.paymentToEmployee (final Payment/Remittance/Virement to employee after any advance), and top-level totalAmount = gross pay for payroll; do not duplicate the same salary as two invoice blocks.
38. PAY SLIPS ONLY: The business posts two payments for tax-at-source employees: (1) paymentToEmployee to the employee, (2) grossPay minus paymentToEmployee to the state for taxes and social contributions. If an advance on salary is deducted before payment, paymentToEmployee is the final Payment line, not netPay.

INCOME vs EXPENSE Detection:
- INCOME: Sales receipts, revenue reports, customer payments, deposits, Z-readings
- EXPENSE: Supplier invoices, bills to pay, purchases, rent, utilities, salaries

MULTI-PAGE / MULTI-INVOICE REQUIREMENT:
- Process the full file from first page to last page.
- Ensure subDocuments covers every detected invoice-like block in the document.
- Do not stop after the first invoice.
- If page quality is poor, still return best-effort extraction with confidence reflected in aiInterpretation.

Return JSON only.`;

    const response = await generateGeminiForDocumentFile(file, storageRef, analysisPrompt, model, {
      responseMimeType: "application/json",
      responseSchema: coreSchema,
      temperature: 0.1,
      topP: 0.8,
      topK: 20,
      maxOutputTokens: resolveMaxOutputTokens(32768),
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ Gemini API responded in ${elapsed}ms`);

    const parsed = sanitizeFinancialDataForUi(
      parseModelJsonResponse<FinancialData>(response.text, "analyze-financial-document")
    );
    console.log(`📊 Parsed data:`, parsed);

    if (parsed.subDocuments && parsed.subDocuments.length > 0) {
       const sum = parsed.subDocuments.reduce((s, doc) => s + (doc.totalAmount || 0), 0);
       if (!parsed.totalAmount || parsed.totalAmount === 0) {
          parsed.totalAmount = sum;
       }
    }

    let normalized = normalizeMultiInvoiceData(parsed);
    normalized = repairPaySlipMultiInvoiceBlocks(normalized, file);
    normalized = syncGrandTotalsFromSubDocuments(normalized);

    // Second-pass exhaustive extraction is expensive; keep it for likely multi-invoice files only.
    const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf && shouldRunExhaustivePdfPass(file, normalized, userHint)) {
      const exhaustive = await extractInvoiceBreakdownExhaustive(file, storageRef, mimeType, model, userHint);
      if (exhaustive?.subDocuments && exhaustive.subDocuments.length > 0) {
        const currentSubCount = Array.isArray(normalized.subDocuments) ? normalized.subDocuments.length : 0;
        const exhaustiveSubCount = exhaustive.subDocuments.length;
        if (exhaustiveSubCount > currentSubCount) {
          normalized = normalizeMultiInvoiceData({
            ...normalized,
            subDocuments: exhaustive.subDocuments as any,
            lineItems: (Array.isArray(exhaustive.lineItems) && exhaustive.lineItems.length > 0)
              ? exhaustive.lineItems
              : normalized.lineItems,
            issuer: `${exhaustiveSubCount} invoices detected`
          });
          console.log(`📚 Exhaustive pass increased invoice blocks: ${currentSubCount} -> ${exhaustiveSubCount}`);
        } else if (exhaustiveSubCount > 0 && exhaustiveSubCount === currentSubCount) {
          normalized = normalizeMultiInvoiceData({
            ...normalized,
            subDocuments: exhaustive.subDocuments as any,
            lineItems: (Array.isArray(exhaustive.lineItems) && exhaustive.lineItems.length > 0)
              ? exhaustive.lineItems
              : normalized.lineItems,
          });
          console.log(`📚 Exhaustive pass refreshed ${exhaustiveSubCount} invoice blocks`);
        }
      }
    } else if (isPdf) {
      console.log('⏩ Skipping exhaustive PDF pass (single-document fast path)');
    }

    normalized = repairPaySlipMultiInvoiceBlocks(normalized, file);
    normalized = applyPayrollPaymentFields(normalized);
    normalized = sanitizeFinancialDataForUi(syncGrandTotalsFromSubDocuments(normalized));
    normalized = sanitizeFinancialDataForUi(applySwissVatWarnings(normalized));

    if (normalized.totalAmount !== undefined && (!normalized.amountInCHF || normalized.amountInCHF === 0)) {
      const rate = await getLiveExchangeRate(normalized.originalCurrency || 'CHF', targetCurrency);
      normalized.amountInCHF = normalized.totalAmount * rate;
      normalized.conversionRateUsed = rate;
    }

    return normalized;
  });
};

// Fixed analyzeBankStatement to properly handle the GenAI response and return BankStatementAnalysis
export const analyzeBankStatement = async (
  file: File,
  targetCurrency: string = 'CHF',
  existingStorage?: { fileUrl?: string; storagePath?: string }
): Promise<BankStatementAnalysis> => {
  const storageRef = await ensureDocumentStorageForAi(file, existingStorage);
  const model = resolveBankStatementModel();

  return withRetry(async () => {
    const response = await generateGeminiForDocumentFile(
      file,
      storageRef,
      `Extract the full multi-page transaction ledger from this bank statement. You MUST find the opening balance and final balance (solde).`,
      model,
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING }
                },
                required: ["date", "description", "amount", "type"]
              }
            },
            calculatedTotalIncome: { type: Type.NUMBER },
            calculatedTotalExpense: { type: Type.NUMBER },
            openingBalance: { type: Type.NUMBER },
            finalBalance: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            period: { type: Type.STRING }
          },
          required: ["transactions", "calculatedTotalIncome", "calculatedTotalExpense", "currency"]
        },
        maxOutputTokens: resolveMaxOutputTokens(24576),
      }
    );

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine");
    return parseModelJsonResponse<BankStatementAnalysis>(text, "analyze-bank-statement");
  });
};
