
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, FinancialData, BankTransaction, BankStatementAnalysis } from "../types";

export function getGeminiApiKey(): string {
  // Support both names to avoid silent breakage across old/new deployments.
  const key = (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY)?.trim();
  if (!key) {
    throw new Error(
      "Missing Gemini key. Set VITE_GEMINI_API_KEY (or VITE_API_KEY) in your host environment or .env.local, then rebuild/redeploy."
    );
  }
  return key;
}

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
        `link billing if Google requires it, set VITE_GEMINI_API_KEY on your deployment, redeploy. Google said: ${apiMessage}`
    );
  }
  if (httpStatus === 401) {
    return new Error(`Gemini rejected the API key (401). Check VITE_GEMINI_API_KEY. Details: ${apiMessage}`);
  }
  if (httpStatus === 429) {
    return new Error(`Gemini quota / rate limited (429). Wait and retry, or raise quota. Details: ${apiMessage}`);
  }

  return error instanceof Error ? error : new Error(String(error));
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
  ai: GoogleGenAI,
  base64: string,
  mimeType: string,
  model: string,
  userHint?: string
): Promise<ExhaustiveInvoicePass | null> {
  const hintSection = userHint ? `USER HINT: "${userHint}".` : "";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: `You are auditing a multi-page PDF containing multiple invoices/receipts.
${hintSection}

MANDATORY:
1. Read EVERY page from first to last.
2. Return one subDocuments entry per distinct invoice/receipt block found.
3. NEVER stop after first 2 pages.
4. If one invoice spans multiple pages, merge it into one entry with a pageRange like "3-4".
5. If there are 5 or 6 invoices, return all 5 or 6 entries.
6. Keep lineItems aligned with all detected invoice entries.

Return JSON only matching schema.`
          }
        ]
      },
      config: {
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
        maxOutputTokens: 8192,
      }
    });

    const parsed = JSON.parse(response.text || '{}') as ExhaustiveInvoicePass;
    return parsed;
  } catch (error) {
    console.warn('Exhaustive invoice pass failed:', error);
    return null;
  }
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

  // If model under-fills subDocuments, derive additional invoice blocks from expense line items.
  const inferredSubDocsFromLineItems = normalizedLineItems
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
    normalizedLineItems.length > 0 && lineSumMatch && normalizedLineItems.length >= repairedSubs.length
      ? normalizedLineItems
      : rebasedItems;

  const rollupFromLines = finalLineItems
    .filter((i) => i.type === 'EXPENSE')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  /** Prefer line-item rollup when model header totals drift from summed expenses. */
  const aggregatedTotal =
    rollupFromLines > 0 && Math.abs(subTotal - rollupFromLines) > 0.06 ? rollupFromLines : subTotal;
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

function shouldRunExhaustivePdfPass(file: File, parsed: FinancialData, userHint?: string): boolean {
  const hint = (userHint || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const hasMultiHint =
    hint.includes('multi') ||
    hint.includes('bulk') ||
    hint.includes('all pages') ||
    name.includes('multi') ||
    name.includes('bulk') ||
    name.includes('z2');
  const extractedSubDocs = Array.isArray(parsed.subDocuments) ? parsed.subDocuments.length : 0;
  // Run second pass only when likely beneficial; otherwise it doubles latency.
  return hasMultiHint || extractedSubDocs > 1;
}


export const analyzeFinancialDocument = async (
  file: File, 
  targetCurrency: string = 'CHF', 
  userHint?: string
): Promise<FinancialData> => {
  const apiKey = getGeminiApiKey();
  const model = resolveDocumentModel();
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  console.log(`📄 Analyzing: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    
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
            },
            required: ["pageRange", "issuer", "date", "totalAmount", "originalCurrency", "expenseCategory", "vatAmount", "vatRate", "netAmount"]
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "expenseCategory"]
    };

    const hintSection = userHint ? `USER HINT: "${userHint}".` : "";

    // Simplified, faster prompt
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `You are a strict Swiss accounting document extraction engine. ${hintSection}

CRITICAL RULES:
1. Identify document type accurately
2. Determine if this is INCOME (revenue, sales, deposits) or EXPENSE (bills, invoices to pay, purchases)
3. For INCOME documents: Set expenseCategory to "REVENUE" or "SALES"
4. For EXPENSE documents: Categorize specifically (e.g., "FOOD_SUPPLIES", "RENT", "UTILITIES")
5. Extract key financial data (amounts, dates, issuer)
6. For bank statements: extract ALL transactions into lineItems
7. For payslips: extract employee/employer info and components
8. Extract VAT if shown (TVA, VAT, MwSt, Tax labels)
9. For multi-document files: use subDocuments array
10. READ ALL PAGES of the PDF. Do not summarize only the first page.
11. If multiple invoices/receipts exist in one PDF, create one subDocuments entry per invoice/receipt with issuer, VAT, net, gross, currency, and pageRange.
12. If VAT is missing for a sub-document, set vatAmount=0 and vatRate=0 (never omit fields).
13. If one invoice spans multiple pages, merge those pages into ONE subDocuments entry with a combined pageRange (e.g. "2-3"), do not duplicate it.
14. For multi-invoice files, include a complete lineItems array derived from all detected invoices.
15. NEVER cap extracted invoices to 2; include every invoice found across all pages.
16. Extract only values visible in the document. Never invent issuer names, dates, VAT, or totals.
17. If a required field is not visible, use safe defaults (empty string for text, 0 for numbers) and continue.
18. Prefer exact numeric copying from document totals over inferred arithmetic when both are present.
19. Keep sign consistency: INCOME amounts positive, EXPENSE amounts positive (classification carries direction).
20. Always return valid JSON that strictly matches the schema and contains no markdown/comments.

INCOME vs EXPENSE Detection:
- INCOME: Sales receipts, revenue reports, customer payments, deposits, Z-readings
- EXPENSE: Supplier invoices, bills to pay, purchases, rent, utilities, salaries

MULTI-PAGE / MULTI-INVOICE REQUIREMENT:
- Process the full file from first page to last page.
- Ensure subDocuments covers every detected invoice-like block in the document.
- Do not stop after the first invoice.
- If page quality is poor, still return best-effort extraction with confidence reflected in aiInterpretation.

Return JSON only.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: coreSchema,
        temperature: 0.1, // Lower temperature for faster, more consistent results
        topP: 0.8,
        topK: 20,
        maxOutputTokens: 8192,
      }
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ Gemini API responded in ${elapsed}ms`);

    const parsed = JSON.parse(response.text) as FinancialData;
    console.log(`📊 Parsed data:`, parsed);

    if (parsed.subDocuments && parsed.subDocuments.length > 0) {
       const sum = parsed.subDocuments.reduce((s, doc) => s + (doc.totalAmount || 0), 0);
       if (!parsed.totalAmount || parsed.totalAmount === 0) {
          parsed.totalAmount = sum;
       }
    }

    let normalized = normalizeMultiInvoiceData(parsed);

    // Second-pass exhaustive extraction is expensive; keep it for likely multi-invoice files only.
    const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPdf && shouldRunExhaustivePdfPass(file, normalized, userHint)) {
      const exhaustive = await extractInvoiceBreakdownExhaustive(ai, base64, mimeType, model, userHint);
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
        }
      }
    } else if (isPdf) {
      console.log('⏩ Skipping exhaustive PDF pass (single-document fast path)');
    }

    if (normalized.totalAmount !== undefined && (!normalized.amountInCHF || normalized.amountInCHF === 0)) {
      const rate = await getLiveExchangeRate(normalized.originalCurrency || 'CHF', targetCurrency);
      normalized.amountInCHF = normalized.totalAmount * rate;
      normalized.conversionRateUsed = rate;
    }

    return normalized;
  });
};

// Fixed analyzeBankStatement to properly handle the GenAI response and return BankStatementAnalysis
export const analyzeBankStatement = async (file: File, targetCurrency: string = 'CHF'): Promise<BankStatementAnalysis> => {
  const apiKey = getGeminiApiKey();
  const model = resolveBankStatementModel();
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Extract the full multi-page transaction ledger from this bank statement. You MUST find the opening balance and final balance (solde).`
          }
        ]
      },
      config: {
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
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine");
    return JSON.parse(text) as BankStatementAnalysis;
  });
};
