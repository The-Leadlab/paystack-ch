
import { generateGeminiContent, generateGeminiContentFromStorage } from "../lib/geminiClient";
import {
  ensureDocumentStorageForAi,
  guessMimeType,
  type DocumentStorageRef,
} from "../lib/documentStorageForAi";
import { MAX_GEMINI_ANALYSIS_BYTES, formatMegabytes } from "@shared/geminiLimits";
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
import {
  getPdfPageCount,
  looksLikeMultiTicketPdf,
  renderPdfPagesToJpegFiles,
  shouldSplitPdfToPageImages,
} from "../lib/pdfPagesToImages";
import { inferLineItemType, matchLineItemTypeFromAi } from "./categoryDetectionService";
import {
  normalizeIsoDate,
  resolveDocumentVatAmount,
  splitIssuerAndReference,
} from "../lib/swissDocumentNormalize";
import { isCsvDocumentFile } from "../lib/businessDocumentFile";
import { parseBusinessCsvFile } from "../lib/businessCsvImport";

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
  config?: unknown,
  signal?: AbortSignal
): Promise<{ text: string }> {
  const requestOptions = signal ? { signal } : undefined;
  if (storageRef) {
    return generateGeminiContentFromStorage(
      {
        model,
        storagePath: storageRef.storagePath,
        fileUrl: storageRef.downloadURL,
        mimeType: storageRef.mimeType,
        contents: { parts: [{ text: promptText }] },
        config,
      },
      requestOptions
    );
  }

  const prepared = await prepareDocumentForAi(file);
  const base64 = await fileToBase64(prepared);
  const mimeType = guessMimeType(file.name, prepared.type || file.type);
  return generateGeminiContent(
    {
      model,
      contents: {
        parts: [{ inlineData: { mimeType, data: base64 } }, { text: promptText }],
      },
      config,
    },
    requestOptions
  );
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
    documentNumber?: string;
    totalAmount?: number;
    originalCurrency?: string;
    documentType?: string;
    expenseCategory?: string;
    vatAmount?: number;
    vatRate?: number;
    netAmount?: number;
    lineItems?: BankTransaction[];
  }>;
  lineItems?: BankTransaction[];
};

async function extractInvoiceBreakdownExhaustive(
  file: File,
  storageRef: DocumentStorageRef | null,
  mimeType: string,
  model: string,
  userHint?: string,
  signal?: AbortSignal,
  retryHint?: string
): Promise<ExhaustiveInvoicePass | null> {
  const hintSection = userHint ? `USER HINT: "${userHint}".` : "";
  const retrySection = retryHint ? `\nRETRY: ${retryHint}\n` : "";
  const promptText = `You are auditing a multi-page PDF that may contain MULTIPLE separate invoices or receipts bound together.
${hintSection}${retrySection}
MANDATORY:
1. Read EVERY page from first to last. Never assume a single invoice. Do not stop after page 1–2.
2. Return one subDocuments entry per DISTINCT invoice/receipt (different issuer, invoice number, or dated block). Do NOT create a subDocuments entry per product line item — line items belong inside an invoice, not as separate invoices.
3. NEVER stop after the first page or first two invoices — binders often have 5–30 invoices.
4. If one invoice spans multiple pages, merge into ONE entry with pageRange like "3-4".
5. Extract per-invoice: issuer = supplier trade name ONLY (never append invoice/ref numbers to issuer). Put invoice/ref in documentNumber when available. date = printed invoice date converted to YYYY-MM-DD (Swiss DD.MM.YYYY → YYYY-MM-DD). NEVER use today's/upload date. Also extract pageRange, originalCurrency, netAmount, vatAmount (TVA CHF), vatRate, totalAmount (gross TTC including VAT). If TVA is printed in a multi-rate table, sum column TVA into vatAmount.
6. Top-level lineItems: one EXPENSE rollup row per sub-invoice (amount = that invoice gross total, description = clean issuer name + pages — no "| REF").
7. Nested subDocuments[].lineItems: when an invoice has an item table, include product rows (description, amount, quantity, unitPrice). Prefer completeness.
8. After extraction, verify detectedInvoiceCount matches len(subDocuments); if not, fix before returning.
9. JSON only: no raw newlines or unescaped " inside strings; keep descriptions short.
10. DISTINCT-INVOICE RULE: invoices with different dates/page blocks/invoice numbers are separate entries, even if supplier and amounts look similar.

Return JSON only matching schema.`;

  const lineItemProps = {
    date: { type: Type.STRING },
    description: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
    category: { type: Type.STRING },
    quantity: { type: Type.NUMBER },
    unitPrice: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  };

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
                  documentNumber: { type: Type.STRING },
                  totalAmount: { type: Type.NUMBER },
                  originalCurrency: { type: Type.STRING },
                  documentType: { type: Type.STRING },
                  expenseCategory: { type: Type.STRING },
                  vatAmount: { type: Type.NUMBER },
                  vatRate: { type: Type.NUMBER },
                  netAmount: { type: Type.NUMBER },
                  lineItems: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: lineItemProps,
                      required: ["description", "amount", "type", "category"],
                    },
                  },
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
        maxOutputTokens: resolveMaxOutputTokens(32768),
      };

  try {
    const response = await generateGeminiForDocumentFile(
      file,
      storageRef,
      promptText,
      model,
      exhaustiveConfig,
      signal
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

function lineItemFromSubDocument(
  sub: any,
  parsed: FinancialData,
  aiLineItems: BankTransaction[],
  notesSuffix: string
): BankTransaction {
  const description = `${sub.issuer || 'Unknown issuer'}${sub.pageRange ? ` (pages ${sub.pageRange})` : ''}`;
  const aiType = matchLineItemTypeFromAi(sub, aiLineItems);
  const type = inferLineItemType({
    expenseCategory: sub.expenseCategory,
    documentType: sub.documentType ?? parsed.documentType,
    description,
    category: sub.expenseCategory,
    issuer: sub.issuer,
    parentExpenseCategory: parsed.expenseCategory,
    existingType: aiType,
  });
  return {
    date: sub.date || parsed.date || new Date().toISOString().slice(0, 10),
    description,
    amount: Number(sub.totalAmount || 0),
    type,
    category: sub.expenseCategory || parsed.expenseCategory || 'OTHER',
    notes: notesSuffix,
  };
}

function normalizeMultiInvoiceData(parsed: FinancialData): FinancialData {
  const subDocs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments : [];
  const normalizedLineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];

  // Never promote product/line items into subDocuments — items stay items; invoices stay invoices.
  // subDocuments are only distinct invoices/receipts from the model (or empty for a single invoice).
  if (subDocs.length === 0) return parsed;

  // Per-invoice amount consistency + aggregate totals must match SUM(sub-invoices).
  const repairedSubs = subDocs.map((sub: any) => {
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

  const rebasedItems: BankTransaction[] = repairedSubs.map((sub: any) =>
    lineItemFromSubDocument(
      sub,
      parsed,
      normalizedLineItems,
      `VAT ${Number(sub.vatRate || 0)}% | VAT Amount ${Number(sub.vatAmount || 0)} ${sub.originalCurrency || parsed.originalCurrency || 'CHF'}`
    )
  );

  // Prefer real product line items on a single invoice; only synthesize one row per invoice for multi-invoice PDFs.
  // Preserve nested product lines on each subDocument (per-item verification).
  const repairedSubsWithItems = repairedSubs.map((sub: any) => {
    const nested = Array.isArray(sub.lineItems) ? sub.lineItems : [];
    if (nested.length > 0) return { ...sub, lineItems: nested };
    // Single-invoice PDF: attach top-level product lines onto the one sub when present.
    if (repairedSubs.length === 1 && normalizedLineItems.length > 0) {
      return { ...sub, lineItems: normalizedLineItems };
    }
    return sub;
  });

  const finalLineItems =
    repairedSubsWithItems.length > 1
      ? rebasedItems
      : normalizedLineItems.length > 0
        ? normalizedLineItems
        : rebasedItems;

  const rollupFromLines = finalLineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  /** For multi-invoice documents, grand total is ALWAYS the sum of invoice-level gross totals. */
  const aggregatedTotal =
    repairedSubsWithItems.length > 1
      ? subTotal
      : rollupFromLines > 0 && Math.abs(subTotal - rollupFromLines) > 0.06
        ? rollupFromLines
        : subTotal;
  const aggregatedVat = repairedSubsWithItems.reduce((sum: number, sub: any) => sum + Number(sub.vatAmount || 0), 0);
  const aggregatedNet = repairedSubsWithItems.reduce((sum: number, sub: any) => sum + Number(sub.netAmount || 0), 0);

  const sortedDates = repairedSubsWithItems.map((s: any) => s.date).filter(Boolean).sort();

  return {
    ...parsed,
    subDocuments: repairedSubsWithItems as any,
    totalAmount: aggregatedTotal,
    vatAmount: aggregatedVat,
    netAmount: aggregatedNet,
    issuer:
      repairedSubsWithItems.length > 1
        ? String(repairedSubsWithItems[0]?.issuer || parsed.issuer || 'Unknown').trim() || 'Unknown'
        : parsed.issuer || repairedSubsWithItems[0]?.issuer || 'Unknown',
    lineItems: finalLineItems,
    date: (sortedDates[0] as string) || parsed.date,
    aiInterpretation: parsed.aiInterpretation || `Detected ${repairedSubsWithItems.length} invoice blocks across all pages.`,
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

function sanitizeLineItemRow(
  item: BankTransaction | any,
  docType: DocumentType,
  parentCat: string
): BankTransaction {
  const amount = toFiniteNumber(item?.amount, 0);
  const description = sanitizeLooseText(item?.description, 220) || 'Unlabeled line item';
  const category = sanitizeLooseText(item?.category, 80) || 'OTHER';
  const rawType = item?.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const qty = toFiniteNumber(item?.quantity, NaN);
  const unit = toFiniteNumber(item?.unitPrice, NaN);
  return {
    date: normalizeIsoDate(item?.date) || sanitizeLooseText(item?.date, 24),
    description,
    amount,
    type: inferLineItemType({
      expenseCategory: category,
      documentType: docType,
      description,
      category,
      parentExpenseCategory: parentCat,
      existingType: rawType,
    }),
    category,
    notes: sanitizeLooseText(item?.notes, 220),
    isHumanVerified: Boolean(item?.isHumanVerified),
    ...(Number.isFinite(qty) && qty > 0 ? { quantity: qty } : {}),
    ...(Number.isFinite(unit) && unit >= 0 ? { unitPrice: unit } : {}),
  };
}

function sanitizeFinancialDataForUi(data: FinancialData): FinancialData {
  const docType = coerceDocumentType(data.documentType);
  const parentCat = sanitizeLooseText(data.expenseCategory, 80) || 'OTHER';

  const safeLineItems: BankTransaction[] = (Array.isArray(data.lineItems) ? data.lineItems : [])
    .map((item) => sanitizeLineItemRow(item, docType, parentCat))
    .filter((item) => item.amount >= 0);

  const rootSwiss = sanitizeSwissVatFields(data, data.expenseCategory || "OTHER");

  const rootSplit = splitIssuerAndReference(data.issuer);
  const safeSubDocuments: FinancialData[] = (Array.isArray(data.subDocuments) ? data.subDocuments : [])
    .map((sub) => {
      const subCat = sanitizeLooseText(sub?.expenseCategory, 80) || data.expenseCategory || "OTHER";
      const subSplit = splitIssuerAndReference(sub?.issuer);
      const nestedItems = (Array.isArray((sub as any)?.lineItems) ? (sub as any).lineItems : [])
        .map((item: BankTransaction) => sanitizeLineItemRow(item, coerceDocumentType(sub?.documentType) || docType, subCat))
        .filter((item: BankTransaction) => item.amount >= 0);
      const baseSub = {
        ...sub,
        pageRange: sanitizeLooseText((sub as any)?.pageRange, 40),
        date: normalizeIsoDate(sub?.date) || sanitizeLooseText(sub?.date, 24),
        issuer: sanitizeLooseText(subSplit.issuer, 120) || "Unknown issuer",
        documentNumber:
          sanitizeLooseText((sub as any)?.documentNumber, 80) ||
          sanitizeLooseText(subSplit.reference, 80) ||
          undefined,
        originalCurrency: sanitizeLooseText(sub?.originalCurrency, 10) || data.originalCurrency || "CHF",
        documentType: coerceDocumentType(sub?.documentType),
        expenseCategory: subCat || "OTHER",
        totalAmount: toFiniteNumber(sub?.totalAmount, 0),
        vatAmount: toFiniteNumber(sub?.vatAmount, 0),
        vatRate: toFiniteNumber((sub as any)?.vatRate, 0),
        netAmount: toFiniteNumber(sub?.netAmount, 0),
        aiInterpretation: sanitizeLooseText(sub?.aiInterpretation, 320),
        ...(nestedItems.length ? { lineItems: nestedItems } : {}),
      } as FinancialData;
      const withSwiss = { ...baseSub, ...sanitizeSwissVatFields(baseSub, subCat) };
      return {
        ...withSwiss,
        vatAmount: resolveDocumentVatAmount(withSwiss),
        date: normalizeIsoDate(withSwiss.date) || withSwiss.date,
        ...(nestedItems.length ? { lineItems: nestedItems } : {}),
      };
    })
    .filter((sub) => toFiniteNumber(sub.totalAmount, 0) >= 0);

  const rootWithSwiss = {
    ...data,
    documentType: coerceDocumentType(data.documentType),
    date: normalizeIsoDate(data.date) || sanitizeLooseText(data.date, 24),
    issuer: sanitizeLooseText(rootSplit.issuer, 120) || "Unknown issuer",
    documentNumber:
      sanitizeLooseText(data.documentNumber, 80) ||
      sanitizeLooseText(rootSplit.reference, 80) ||
      undefined,
    originalCurrency: sanitizeLooseText(data.originalCurrency, 10) || "CHF",
    expenseCategory: sanitizeLooseText(data.expenseCategory, 80) || "OTHER",
    notes: sanitizeLooseText(data.notes, 280),
    aiInterpretation: sanitizeLooseText(data.aiInterpretation, 380),
    totalAmount: toFiniteNumber(data.totalAmount, 0),
    vatAmount: toFiniteNumber(data.vatAmount, 0),
    vatRate: toFiniteNumber((data as any).vatRate, 0),
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
    ...rootSwiss,
    lineItems: safeLineItems,
    subDocuments: safeSubDocuments,
  } as FinancialData;

  return {
    ...rootWithSwiss,
    vatAmount: resolveDocumentVatAmount(rootWithSwiss),
    date:
      normalizeIsoDate(rootWithSwiss.date) ||
      (safeSubDocuments.map((s) => normalizeIsoDate(s.date)).find(Boolean) as string | undefined) ||
      rootWithSwiss.date,
  };
}

function maxPageMentionedInSubDocs(parsed: FinancialData): number {
  const subs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments : [];
  let max = 0;
  for (const sub of subs) {
    const nums = String((sub as { pageRange?: string }).pageRange || '').match(/\d+/g);
    if (!nums) continue;
    for (const n of nums) max = Math.max(max, Number(n) || 0);
  }
  return max;
}

function shouldRunExhaustivePdfPass(
  file: File,
  parsed: FinancialData,
  userHint?: string,
  forceDeep = false
): boolean {
  if (isPaySlipFinancialData(parsed, file)) return false;
  if (forceDeep) return true;

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

  // Explicit user/filename hint always triggers the second pass
  if (hasMultiHint) return true;

  const extractedSubDocs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments.length : 0;
  const lineCount = Array.isArray(parsed.lineItems) ? parsed.lineItems.length : 0;
  const maxPage = maxPageMentionedInSubDocs(parsed);
  // Multi-page binders are often ~80KB+; Gemini frequently stops after 2–3 invoices.
  const likelyMultiPagePdf = file.size >= 80_000;
  const pageCoverageGap = maxPage >= 4 && maxPage > extractedSubDocs + 1;

  // Large PDF with few invoices — always re-scan (under-extraction of binders).
  if (likelyMultiPagePdf && extractedSubDocs <= 3) {
    return true;
  }

  if (extractedSubDocs >= 2 && (likelyMultiPagePdf || pageCoverageGap)) {
    return true;
  }

  if (extractedSubDocs >= 1 && pageCoverageGap) {
    return true;
  }

  const suspiciousUnderSplit = extractedSubDocs <= 1 && lineCount >= 6;
  return (
    (suspiciousUnderSplit && likelyMultiPagePdf) ||
    (extractedSubDocs === 0 && likelyMultiPagePdf && lineCount >= 3)
  );
}

/** Count product-like lines (exclude synthetic invoice rollups). */
function countProductLineItems(data: FinancialData): number {
  const isRollup = (item: BankTransaction) => {
    const notes = (item.notes || '').toLowerCase();
    if (notes.includes('vat amount') || notes.includes('vat %')) return true;
    if (/\(pages?\s+/i.test(item.description || '')) return true;
    return false;
  };
  const top = (Array.isArray(data.lineItems) ? data.lineItems : []).filter((i) => !isRollup(i));
  const nested = (Array.isArray(data.subDocuments) ? data.subDocuments : []).flatMap((sub) => {
    const items = Array.isArray((sub as FinancialData).lineItems)
      ? ((sub as FinancialData).lineItems as BankTransaction[])
      : [];
    return items.filter((i) => !isRollup(i));
  });
  return Math.max(top.length, nested.length);
}

/**
 * True when the model likely collapsed an itemized invoice into a single total row
 * (or returned no product lines at all).
 */
function needsProductLineItemPass(file: File, parsed: FinancialData, forceDeep = false): boolean {
  if (isPaySlipFinancialData(parsed, file)) return false;
  const docType = String(parsed.documentType || '');
  if (
    docType === DocumentType.BANK_STATEMENT ||
    docType === 'BANK_STATEMENT' ||
    docType === DocumentType.PAY_SLIP ||
    docType === 'Pay Slip'
  ) {
    return false;
  }

  if (forceDeep) {
    // Deep beta: recover products whenever any invoice block lacks nested product rows.
    const subs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments : [];
    if (subs.length === 0) {
      return countProductLineItems(parsed) < 2 && Math.abs(Number(parsed.totalAmount || 0)) > 0;
    }
    return subs.some((sub) => {
      const total = Math.abs(Number((sub as FinancialData).totalAmount || 0));
      const nested = Array.isArray((sub as FinancialData).lineItems)
        ? ((sub as FinancialData).lineItems as BankTransaction[])
        : [];
      const productNested = nested.filter((i) => {
        const notes = (i.notes || '').toLowerCase();
        if (notes.includes('vat amount') || notes.includes('vat %')) return false;
        if (/\(pages?\s+/i.test(i.description || '')) return false;
        return true;
      });
      return total > 0 && productNested.length < 2;
    });
  }

  const productCount = countProductLineItems(parsed);
  const total = Math.abs(Number(parsed.totalAmount || 0));
  if (productCount === 0 && total > 0) return true;

  // Multi-invoice binder: any sub with money but no nested products.
  const subs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments : [];
  if (subs.length >= 2) {
    const missingNested = subs.some((sub) => {
      const subTotal = Math.abs(Number((sub as FinancialData).totalAmount || 0));
      const nested = Array.isArray((sub as FinancialData).lineItems)
        ? ((sub as FinancialData).lineItems as BankTransaction[])
        : [];
      const productNested = nested.filter((i) => {
        const notes = (i.notes || '').toLowerCase();
        if (notes.includes('vat amount') || notes.includes('vat %')) return false;
        if (/\(pages?\s+/i.test(i.description || '')) return false;
        return true;
      });
      return subTotal > 0 && productNested.length === 0;
    });
    if (missingNested) return true;
  }

  if (productCount === 1) {
    const candidates = [
      ...(Array.isArray(parsed.lineItems) ? parsed.lineItems : []),
      ...(Array.isArray(parsed.subDocuments) ? parsed.subDocuments : []).flatMap(
        (s) => ((s as FinancialData).lineItems as BankTransaction[] | undefined) || []
      ),
    ];
    const only = candidates[0];
    if (only && total > 0 && Math.abs(Number(only.amount || 0) - total) < 0.05) {
      return true;
    }
  }
  return false;
}

type ProductLineItemPass = {
  lineItems?: BankTransaction[];
};

/**
 * Dedicated pass: extract EVERY article/product row from itemized Swiss invoices
 * (Bulletin de livraison, Feldschlösschen-style tables, etc.).
 */
async function extractProductLineItemsPass(
  file: File,
  storageRef: DocumentStorageRef | null,
  model: string,
  base: FinancialData,
  userHint?: string,
  signal?: AbortSignal
): Promise<BankTransaction[] | null> {
  const hintSection = userHint ? `USER HINT: "${userHint}".` : '';
  const issuer = String(base.issuer || '').trim();
  const date = String(base.date || '').trim();
  const currency = String(base.originalCurrency || 'CHF').trim() || 'CHF';
  const category = String(base.expenseCategory || 'BEVERAGES').trim() || 'BEVERAGES';

  const promptText = `You extract PRODUCT LINE ITEMS from a Swiss supplier invoice / delivery note (Bulletin de livraison / Lieferschein / Facture).
${hintSection}

Context: issuer="${issuer}", date="${date}", currency="${currency}", document total ≈ ${Number(base.totalAmount || 0)}.

MANDATORY:
1. Read EVERY page. Extract EVERY article/product/service row from item tables.
2. Swiss beverage tables often have columns: Article, Désignation, Contenu, Quantité, Unité, Prix, Valeur, TVA, Consigne. For each article row:
   - description = Désignation (product name), keep under 120 chars
   - quantity = package count when clear (e.g. 2 from "2 FUT", 4 from "4 CA")
   - unitPrice = Prix
   - amount = Valeur (merchandise line value — NOT the whole invoice total)
   - type = EXPENSE
   - category = "${category}" (or BEVERAGES / FOOD_SUPPLIES when obvious)
   - date = "${date || 'invoice date YYYY-MM-DD'}"
3. If Consigne (deposit) > 0 on a row, ALSO add a separate line: description "Consigne — {Désignation}", amount = Consigne, type EXPENSE, same category.
4. Multiple "Commande" / "Bulletin de livraison" sections from the SAME supplier under ONE Montant final = still ONE list — include ALL article rows from ALL sections.
5. Also extract footer fee lines when printed: tax recycling, logistics, eco-tax, empty returns (each as its own lineItem).
6. NEVER return only one line equal to the invoice Montant final. That is a failure.
7. SKIP sous-total, total, TVA summary, and header-only rows.
8. Return as many lines as there are article rows (often 10–80). Prefer completeness over brevity.
9. JSON only. Numbers must be plain finite numbers (no apostrophes in 1'642.65 — use 1642.65).

Return JSON matching schema.`;

  const schema = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE'] },
              category: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unitPrice: { type: Type.NUMBER },
              notes: { type: Type.STRING },
            },
            required: ['description', 'amount', 'type', 'category'],
          },
        },
      },
      required: ['lineItems'],
    },
    temperature: 0.05,
    topP: 0.9,
    topK: 20,
    maxOutputTokens: resolveMaxOutputTokens(32768),
  };

  try {
    const response = await generateGeminiForDocumentFile(
      file,
      storageRef,
      promptText,
      model,
      schema,
      signal
    );
    const parsed = parseModelJsonResponse<ProductLineItemPass>(
      response.text,
      'product-line-items-pass'
    );
    const items = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    const cleaned = items
      .map((item) => sanitizeLineItemRow(item, coerceDocumentType(base.documentType), category))
      .filter((item) => item.amount > 0 && item.description.trim().length > 0);
    return cleaned.length > 0 ? cleaned : null;
  } catch (error) {
    console.warn('Product line-items pass failed:', error);
    return null;
  }
}

function mergeProductLineItemsIntoData(
  data: FinancialData,
  products: BankTransaction[]
): FinancialData {
  if (!products.length) return data;
  const subs = Array.isArray(data.subDocuments) ? data.subDocuments : [];

  // Same-supplier multi-Commande mis-split: collapse to one invoice + all products.
  const issuers = new Set(
    subs.map((s) => String((s as FinancialData).issuer || '').trim().toLowerCase()).filter(Boolean)
  );
  const sameSupplierBlocks = subs.length > 1 && issuers.size <= 1;

  if (subs.length === 0 || sameSupplierBlocks) {
    const primary = (subs[0] as FinancialData | undefined) || data;
    return {
      ...data,
      subDocuments: sameSupplierBlocks
        ? [
            {
              ...primary,
              totalAmount: Number(data.totalAmount || primary.totalAmount || 0),
              vatAmount: Number(data.vatAmount || primary.vatAmount || 0),
              netAmount: Number(data.netAmount || primary.netAmount || 0),
              lineItems: products,
            } as FinancialData,
          ]
        : data.subDocuments,
      lineItems: products,
      aiInterpretation: sanitizeLooseText(
        `${data.aiInterpretation || ''} Extracted ${products.length} product line items.`.trim(),
        400
      ),
    };
  }

  // True multi-invoice: distribute products across subs by date/issuer match when possible.
  const used = new Set<number>();
  const repairedSubs = subs.map((sub) => {
    const nested = Array.isArray((sub as FinancialData).lineItems)
      ? ((sub as FinancialData).lineItems as BankTransaction[])
      : [];
    const productNested = nested.filter((i) => {
      const notes = (i.notes || '').toLowerCase();
      if (notes.includes('vat amount') || notes.includes('vat %')) return false;
      if (/\(pages?\s+/i.test(i.description || '')) return false;
      return true;
    });
    if (productNested.length >= 2) return sub;

    const issuer = String((sub as FinancialData).issuer || '').trim().toLowerCase();
    const date = String((sub as FinancialData).date || '').trim();
    const matched: BankTransaction[] = [];
    products.forEach((p, idx) => {
      if (used.has(idx)) return;
      const pDate = String(p.date || '').trim();
      const pDesc = String(p.description || '').toLowerCase();
      const dateOk = !date || !pDate || pDate === date;
      const issuerOk = !issuer || pDesc.includes(issuer) || issuer.includes(pDesc.slice(0, 12));
      if (dateOk && (issuerOk || (!issuer && dateOk))) {
        matched.push(p);
        used.add(idx);
      }
    });

    if (matched.length >= 2) {
      return { ...(sub as FinancialData), lineItems: matched };
    }
    return sub;
  });

  // Leftover / unmatched products → first sub still missing nested products
  const leftovers = products.filter((_, idx) => !used.has(idx));
  const withLeftovers = repairedSubs.map((sub, idx) => {
    if (leftovers.length === 0) return sub;
    const nested = Array.isArray((sub as FinancialData).lineItems)
      ? ((sub as FinancialData).lineItems as BankTransaction[])
      : [];
    const productNested = nested.filter((i) => {
      const notes = (i.notes || '').toLowerCase();
      if (notes.includes('vat amount') || notes.includes('vat %')) return false;
      if (/\(pages?\s+/i.test(i.description || '')) return false;
      return true;
    });
    if (productNested.length >= 2) return sub;
    if (idx === repairedSubs.findIndex((s) => {
      const n = Array.isArray((s as FinancialData).lineItems)
        ? ((s as FinancialData).lineItems as BankTransaction[])
        : [];
      const pn = n.filter((i) => {
        const notes = (i.notes || '').toLowerCase();
        if (notes.includes('vat amount') || notes.includes('vat %')) return false;
        if (/\(pages?\s+/i.test(i.description || '')) return false;
        return true;
      });
      return pn.length < 2;
    })) {
      return { ...(sub as FinancialData), lineItems: [...productNested, ...leftovers] };
    }
    return sub;
  });

  return {
    ...data,
    subDocuments: withLeftovers as FinancialData[],
    aiInterpretation: sanitizeLooseText(
      `${data.aiInterpretation || ''} Extracted ${products.length} product line items on invoice blocks.`.trim(),
      400
    ),
  };
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
        conversionRateUsed: Number((sub as any).conversionRateUsed) || dataIn.conversionRateUsed || 1,
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


export type AnalyzeFinancialDocumentOptions = {
  /** Admin beta: always run exhaustive + product recovery for non-payslip PDFs. */
  forceDeepPdfReads?: boolean;
  /** Force rasterizing each PDF page to JPEG before AI (ticket sheets). */
  forcePdfPageSplit?: boolean;
  /** Internal: skip page-split when already analyzing a page image. */
  skipPdfPageSplit?: boolean;
};

/** Merge per-page analyses into one multi-receipt FinancialData. */
function mergePdfPageAnalyses(pages: FinancialData[], sourceFileName: string): FinancialData {
  type WithPageRange = FinancialData & { pageRange?: string };
  const subs: WithPageRange[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const pageLabel = String(i + 1);
    const nested = Array.isArray(page.subDocuments) ? page.subDocuments : [];
    if (nested.length > 0) {
      for (const sub of nested) {
        const s = sub as WithPageRange;
        subs.push({
          ...s,
          pageRange: String(s.pageRange || pageLabel),
        });
      }
    } else {
      subs.push({
        ...(page as WithPageRange),
        pageRange: pageLabel,
        subDocuments: undefined,
      });
    }
  }

  const first = pages[0];
  const merged = normalizeMultiInvoiceData({
    documentType:
      first?.documentType === DocumentType.Z2_BULK_REPORT ||
      /ticket|z2/i.test(sourceFileName)
        ? DocumentType.Z2_BULK_REPORT
        : first?.documentType || DocumentType.RECEIPT,
    date: first?.date,
    issuer: first?.issuer || "Multiple receipts",
    originalCurrency: first?.originalCurrency || "CHF",
    expenseCategory: first?.expenseCategory || "OTHER",
    confidenceScore: first?.confidenceScore ?? 0.7,
    aiInterpretation: `Split ${pages.length}-page PDF into per-page images and analyzed each receipt separately.`,
    forensicAlerts: pages.flatMap((p) => (Array.isArray(p.forensicAlerts) ? p.forensicAlerts : [])),
    subDocuments: subs,
    lineItems: [],
    totalAmount: 0,
    vatAmount: 0,
    netAmount: 0,
  } as unknown as FinancialData);

  return syncGrandTotalsFromSubDocuments(merged);
}

export const analyzeFinancialDocument = async (
  file: File,
  targetCurrency: string = 'CHF',
  userHint?: string,
  existingStorage?: { fileUrl?: string; storagePath?: string },
  signal?: AbortSignal,
  options?: AnalyzeFinancialDocumentOptions
): Promise<FinancialData> => {
  // CSV: deterministic multi-row parse (Gemini collapses large sheets to the first invoice).
  if (isCsvDocumentFile(file)) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    console.log(`📊 CSV deterministic parse: ${file.name}`);
    const { data, rowCount, incomeCount, expenseCount } = await parseBusinessCsvFile(
      file,
      targetCurrency
    );
    console.log(
      `📊 CSV parsed ${rowCount} rows (${incomeCount} income / ${expenseCount} expense)`
    );
    return data;
  }

  if (file.size > MAX_GEMINI_ANALYSIS_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatMegabytes(file.size)} MB. AI extraction supports up to ${formatMegabytes(MAX_GEMINI_ANALYSIS_BYTES)} MB per Google Gemini — compress or split the PDF. The file can still be stored for viewing.`
    );
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Ticket/receipt multi-page sheets → one JPEG per page → analyze one-by-one.
  if (isPdf && !options?.skipPdfPageSplit && typeof document !== "undefined") {
    try {
      const ticketLike =
        options?.forcePdfPageSplit === true || looksLikeMultiTicketPdf(file, userHint);
      const pageCount = await getPdfPageCount(file);
      const split =
        shouldSplitPdfToPageImages(file, pageCount, userHint, options?.forcePdfPageSplit === true) &&
        !/pay\s*slip|salary|lohn|bulletin\s*de\s*salaire/i.test(`${file.name} ${userHint || ""}`);
      // forcePdfPageSplit from DocumentProcessor when name matched but page peek was flaky
      const doSplit =
        split ||
        (ticketLike &&
          pageCount >= 2 &&
          !/pay\s*slip|salary|lohn|bulletin\s*de\s*salaire/i.test(`${file.name} ${userHint || ""}`));
      if (doSplit) {
        console.log(`🧾 PDF page-split: ${file.name} → ${pageCount} page image(s)`);
        const images = await renderPdfPagesToJpegFiles(file, signal);
        const pageResults: FinancialData[] = [];
        for (let i = 0; i < images.length; i += 1) {
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          console.log(`🧾 Analyzing page ${i + 1}/${images.length}: ${images[i].name}`);
          const pageData = await analyzeFinancialDocument(
            images[i],
            targetCurrency,
            userHint
              ? `${userHint} (page ${i + 1} of ${images.length} from ${file.name})`
              : `Page ${i + 1} of ${images.length} from multi-ticket PDF ${file.name}`,
            undefined,
            signal,
            { skipPdfPageSplit: true, forceDeepPdfReads: false }
          );
          pageResults.push(pageData);
        }
        let merged = mergePdfPageAnalyses(pageResults, file.name);
        merged = sanitizeFinancialDataForUi(applySwissVatWarnings(merged));
        if (merged.totalAmount !== undefined && (!merged.amountInCHF || merged.amountInCHF === 0)) {
          const rate = await getLiveExchangeRate(merged.originalCurrency || "CHF", targetCurrency);
          merged = {
            ...merged,
            amountInCHF: merged.totalAmount * rate,
            conversionRateUsed: rate,
          };
        }
        return merged;
      }
    } catch (splitErr) {
      console.warn("⚠️ PDF page-split failed; falling back to full-PDF analysis:", splitErr);
    }
  }

  // Skip upload when caller already resolved storage (processDoc pre-uploads)
  const storageRef = (existingStorage?.fileUrl && existingStorage?.storagePath)
    ? { downloadURL: existingStorage.fileUrl, storagePath: existingStorage.storagePath, mimeType: file.type || 'application/octet-stream' }
    : await ensureDocumentStorageForAi(file, existingStorage);
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
        date: {
          type: Type.STRING,
          description:
            "Printed invoice/document date as YYYY-MM-DD. Convert Swiss DD.MM.YYYY. Never use upload/today date.",
        },
        issuer: {
          type: Type.STRING,
          description:
            "Supplier/company trade name only. Do NOT append invoice number, reference, or '| REF …'.",
        },
        documentNumber: {
          type: Type.STRING,
          description: "Invoice / facture / Beleg / reference number if printed (not in issuer).",
        },
        totalAmount: { type: Type.NUMBER, description: "Total amount INCLUDING VAT (TTC)" },
        originalCurrency: { type: Type.STRING },
        vatAmount: {
          type: Type.NUMBER,
          description:
            "TVA/VAT amount in document currency. Prefer printed Total TVA or sum of swissVatBreakdown. Only 0 if truly exempt/not shown.",
        },
        vatRate: { type: Type.NUMBER, description: "VAT rate % when a single rate applies (e.g. 8.1, 2.6)." },
        netAmount: { type: Type.NUMBER, description: "Amount BEFORE VAT (HT)" },
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
          description:
            "EVERY product/service/fee/deposit row on the invoice (not a single total row). For Swiss beverage delivery notes: one entry per Article/Désignation row (amount=Valeur) plus Consigne rows when >0.",
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING },
              quantity: { type: Type.NUMBER, description: "Quantity when printed on the line" },
              unitPrice: { type: Type.NUMBER, description: "Unit price when printed on the line" },
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
              documentType: {
                type: Type.STRING,
                enum: ["Invoice", "VOUCHER", "TICKET/RECEIPT", "BANK_DEPOSIT", "OTHER"],
              },
              expenseCategory: { type: Type.STRING },
              vatAmount: { type: Type.NUMBER },
              vatRate: { type: Type.NUMBER },
              netAmount: { type: Type.NUMBER },
              lineItems: {
                type: Type.ARRAY,
                description:
                  "Product/service/deposit lines ON this invoice only (Article rows). Never only the invoice gross total.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                    category: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unitPrice: { type: Type.NUMBER },
                  }
                }
              },
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
            required: ["issuer", "totalAmount", "originalCurrency", "expenseCategory"]
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
4. For EXPENSE documents: ALWAYS assign a precise category — NEVER use "OTHER" when you can classify. Prefer one of: FOOD_SUPPLIES, BEVERAGES, RESTAURANT_SUPPLIES, PACKAGING, CLEANING, MAINTENANCE, RENT, UTILITIES, INSURANCE, TELECOM, BANK_FEES, ACCOUNTING, MARKETING, DELIVERY, OFFICE_SUPPLIES, LICENSES, TAXES, PAYROLL, PAYROLL_TAXES, SUPPLIERS, BILLS. Use issuer name + line items to decide (e.g. Transgourmet/Aligro → FOOD_SUPPLIES; Swisscom → TELECOM; landlord → RENT).
5. Extract key financial data (amounts, printed dates, issuer). DATE RULE: date MUST be the date printed on the invoice/receipt/ticket (Facture du / Datum / Date), converted to YYYY-MM-DD. Swiss DD.MM.YYYY → YYYY-MM-DD. NEVER use today's date, upload date, or processing date.
6. For bank statements: extract ALL transactions into lineItems
7. For payslips: extract employee/employer info and components
8. Extract VAT if shown (TVA, VAT, MwSt, Tax labels). Prefer explicit Total TVA; else sum multi-rate columns; else derive gross−net. Do not leave vatAmount=0 when TVA is visible.
9. For multi-document files (NOT pay slips): use subDocuments array — one entry per separate supplier invoice only
10. READ ALL PAGES of the PDF. Do not summarize only the first page.
11. If multiple invoices/receipts exist in one PDF, create one subDocuments entry per invoice/receipt with clean issuer (no "| REF"), documentNumber for the invoice ref, printed date, VAT, net, gross, currency, and pageRange.
12. If VAT is truly not printed and cannot be derived, set vatAmount=0 and vatRate=0 and add a forensicAlerts note (never omit fields).
13. If one invoice spans multiple pages, merge those pages into ONE subDocuments entry with a combined pageRange (e.g. "2-3"), do not duplicate it.
14. For multi-invoice files: top-level lineItems = ONE row per invoice (gross total per invoice), description = clean supplier name only. ALSO put product/service lines into each subDocuments[i].lineItems when those lines are visible on that invoice (do not put product lines only at top-level for multi-invoice).
15. NEVER cap extracted invoices to 2 or 3; include EVERY distinct invoice found across ALL pages (a 7-page binder may have 5–7 invoices).
16. Extract only values visible in the document. Never invent issuer names, dates, VAT, or totals. ISSUER RULE: issuer is the company name only; put Facture/N°/Ref in documentNumber — never "Name | Ref 12345".
17. If a required field is not visible, use safe defaults (empty string for text, 0 for numbers, pageRange="" if unknown) and continue — never drop an invoice because one field is hard to read.
18. Prefer exact numeric copying from document totals over inferred arithmetic when both are present. NEVER round money to whole francs — keep centimes exactly as printed (e.g. 1499.50 stays 1499.50, not 1500).
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
39. ITEMS vs INVOICES: lineItems are products/services ON an invoice. Never create a subDocuments entry per line item. subDocuments are ONLY for distinct invoices/receipts (different supplier, invoice number, or separate receipt). One invoice with 20 products → subDocuments empty or one entry + 20 lineItems. A PDF with 3 separate supplier invoices → 3 subDocuments (label "3 invoices detected"), not "items".
40. PER-ITEM DETECTION (CRITICAL): For Invoice / Ticket/Receipt / Bulletin de livraison / Lieferschein, extract EVERY visible product or service line into lineItems (description, amount; quantity and unitPrice when printed). NEVER collapse an itemized invoice into a single lineItem equal to Montant final / Total TTC. If the PDF has an article table, returning only one total row is a hard failure.
41. SWISS DELIVERY / BEVERAGE TABLES: Columns often include Article, Désignation, Contenu, Quantité, Unité, Prix, Valeur, TVA, Consigne. One lineItem per article row: description=Désignation, quantity=package count when clear, unitPrice=Prix, amount=Valeur. If Consigne>0, also add "Consigne — {Désignation}" as a separate EXPENSE line with amount=Consigne. Include recycling tax / logistics / eco-tax footer lines as their own lineItems. Skip sous-total and total rows.
42. SAME-SUPPLIER COMMANDE BLOCKS: Multiple "Commande" / "Bulletin de livraison" sections from the SAME issuer under ONE Montant final = ONE invoice. Put ALL article rows into top-level lineItems (and into that single subDocument.lineItems if you emit one sub). Do NOT create one subDocuments entry per Commande unless each block is a separately payable invoice with its own total due.
43. CATEGORY HINT: Beverage wholesalers (Feldschlösschen, Heineken, Coca-Cola, Valaisanne, etc.) → expenseCategory BEVERAGES; food wholesalers → FOOD_SUPPLIES.

INCOME vs EXPENSE Detection:
- INCOME: Sales receipts, revenue reports, customer payments, deposits, Z-readings
- EXPENSE: Supplier invoices, bills to pay, purchases, rent, utilities, salaries

MULTI-PAGE / MULTI-INVOICE REQUIREMENT:
- Process the full file from first page to last page.
- Ensure subDocuments covers every detected invoice-like block in the document.
- Do not stop after the first invoice.
- If page quality is poor, still return best-effort extraction with confidence reflected in aiInterpretation.

Return JSON only.`;

    const response = await generateGeminiForDocumentFile(
      file,
      storageRef,
      analysisPrompt,
      model,
      {
        responseMimeType: "application/json",
        responseSchema: coreSchema,
        temperature: 0.1,
        topP: 0.8,
        topK: 20,
        maxOutputTokens: resolveMaxOutputTokens(32768),
      },
      signal
    );

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

    const forceDeep = options?.forceDeepPdfReads === true;
    const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    // Second-pass exhaustive extraction for multi-invoice binders (or deep beta).
    if (isPdf && shouldRunExhaustivePdfPass(file, normalized, userHint, forceDeep)) {
      const applyExhaustive = (exhaustive: ExhaustiveInvoicePass, label: string) => {
        if (!exhaustive.subDocuments || exhaustive.subDocuments.length === 0) return false;
        const currentSubCount = Array.isArray(normalized.subDocuments) ? normalized.subDocuments.length : 0;
        const currentMaxPage = maxPageMentionedInSubDocs(normalized);
        const exhaustiveSubCount = exhaustive.subDocuments.length;
        const exhaustiveMaxPage = maxPageMentionedInSubDocs({
          ...normalized,
          subDocuments: exhaustive.subDocuments as FinancialData[],
        });
        const betterCoverage = exhaustiveMaxPage > currentMaxPage;
        const shouldTake =
          forceDeep ||
          exhaustiveSubCount > currentSubCount ||
          betterCoverage ||
          (exhaustiveSubCount > 0 && exhaustiveSubCount === currentSubCount);

        if (!shouldTake) return false;

        normalized = normalizeMultiInvoiceData({
          ...normalized,
          subDocuments: exhaustive.subDocuments as any,
          lineItems:
            Array.isArray(exhaustive.lineItems) && exhaustive.lineItems.length > 0
              ? exhaustive.lineItems
              : normalized.lineItems,
          issuer:
            String(exhaustive.subDocuments[0]?.issuer || normalized.issuer || 'Unknown').trim() ||
            'Unknown',
        });
        console.log(
          `📚 Exhaustive pass (${label}): ${currentSubCount} -> ${exhaustiveSubCount} invoices` +
            (betterCoverage ? ` (pages → ${exhaustiveMaxPage})` : '')
        );
        return true;
      };

      let exhaustive = await extractInvoiceBreakdownExhaustive(
        file,
        storageRef,
        mimeType,
        model,
        userHint,
        signal
      );
      if (exhaustive) applyExhaustive(exhaustive, 'primary');

      let claimed = Number(exhaustive?.detectedInvoiceCount || 0);
      let got = Array.isArray(normalized.subDocuments) ? normalized.subDocuments.length : 0;
      if (claimed > got) {
        const retry = await extractInvoiceBreakdownExhaustive(
          file,
          storageRef,
          mimeType,
          model,
          userHint,
          signal,
          `You previously reported ${claimed} invoices but only returned ${got}. Re-read EVERY remaining page and return ALL distinct invoices — do not stop early.`
        );
        if (retry) {
          applyExhaustive(retry, 'retry-missed');
          exhaustive = retry;
          claimed = Number(retry.detectedInvoiceCount || claimed);
          got = Array.isArray(normalized.subDocuments) ? normalized.subDocuments.length : 0;
        }
      }

      if (claimed > got) {
        const alerts = new Set(Array.isArray(normalized.forensicAlerts) ? normalized.forensicAlerts : []);
        alerts.add(
          `Invoice count mismatch: model reported ${claimed} invoices but only ${got} were extracted. Re-process or review pages manually.`
        );
        normalized = { ...normalized, forensicAlerts: Array.from(alerts) };
      }
    } else if (isPdf) {
      console.log('⏩ Skipping exhaustive PDF pass (single-document fast path)');
    }

    // Recover product lines when collapsed to totals, missing on sub-invoices, or deep beta.
    if (isPdf && needsProductLineItemPass(file, normalized, forceDeep)) {
      console.log('🧾 Running product line-items recovery pass…');
      const products = await extractProductLineItemsPass(
        file,
        storageRef,
        model,
        normalized,
        userHint,
        signal
      );
      if (products && products.length >= 2) {
        normalized = mergeProductLineItemsIntoData(normalized, products);
        console.log(`🧾 Product line-items pass recovered ${products.length} rows`);
      } else {
        console.log('🧾 Product line-items pass returned insufficient rows — keeping first-pass data');
      }
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
  existingStorage?: { fileUrl?: string; storagePath?: string },
  options?: { preferInline?: boolean }
): Promise<BankStatementAnalysis> => {
  const INLINE_MAX_BYTES = 3_500_000;
  const preferInline = options?.preferInline === true && file.size > 0 && file.size <= INLINE_MAX_BYTES;

  let storageRef: Awaited<ReturnType<typeof ensureDocumentStorageForAi>> = null;
  if (!preferInline) {
    try {
      storageRef = await ensureDocumentStorageForAi(file, existingStorage);
    } catch (uploadErr) {
      // Personal uploads often hit Storage rule/Admin mismatches; continue with inline bytes.
      console.warn('ensureDocumentStorageForAi failed; using inline Gemini payload:', uploadErr);
      storageRef = null;
    }
  }

  const model = resolveBankStatementModel();
  const prompt = `Extract the full multi-page transaction ledger from this bank statement (${targetCurrency}).
You MUST extract every transaction you can read: date, description, amount, and whether it is INCOME or EXPENSE.
Also find opening balance and final balance (solde) when present.
For Swiss household statements, keep merchant names (Migros, Coop, Swisscom, Serafe, rent/loyer, pillar 3a, etc.).`;

  const runOnce = async (ref: typeof storageRef) =>
    withRetry(async () => {
      const response = await generateGeminiForDocumentFile(
        file,
        ref,
        prompt,
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

  try {
    return await runOnce(storageRef);
  } catch (firstErr) {
    if (storageRef) {
      console.warn('Storage-backed bank statement AI failed; retrying inline:', firstErr);
      return await runOnce(null);
    }
    throw firstErr;
  }
};
