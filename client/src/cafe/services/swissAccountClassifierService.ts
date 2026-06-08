import { generateGeminiContent } from "../lib/geminiClient";
import {
  buildExtractionFromFinancialData,
  pickSwissAccountRagOnly,
  retrieveRelevantSwissAccounts,
  type DocumentExtractionForClassification,
  type SwissTaxonomyAccount,
} from "@shared/swissAccountRag";
import { getSwissAccount } from "@shared/swissChartOfAccounts";
import { suggestSwissAccountCode } from "@shared/suggestSwissAccountCode";
import type { FinancialData, SwissAccountClassification } from "../types";

export const SWISS_ACCOUNT_CONFIDENCE_AUTO = 0.85;

function resolveClassifierModel(): string {
  return (
    import.meta.env.VITE_GEMINI_CLASSIFIER_MODEL?.trim() ||
    import.meta.env.VITE_GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : t).trim();
}

function parseClassifierJson(raw: string): Record<string, unknown> {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("Classifier returned invalid JSON");
  }
}

function accountLabel(code: string): string {
  const a = getSwissAccount(code);
  return a ? `${a.labelFr} / ${a.labelEn}` : code;
}

function normalizeClassification(
  raw: Record<string, unknown>,
  candidates: SwissTaxonomyAccount[]
): SwissAccountClassification {
  const code = String(raw.account_code || "").trim();
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0));
  const requires =
    Boolean(raw.requires_human_review) ||
    confidence < SWISS_ACCOUNT_CONFIDENCE_AUTO ||
    Boolean(raw.splits);

  const candidate = candidates.find((c) => c.account_code === code);
  const splitsRaw = raw.splits;
  const splits = Array.isArray(splitsRaw)
    ? splitsRaw
        .map((s) => {
          const row = s as Record<string, unknown>;
          return {
            account_code: String(row.account_code || ""),
            amount: row.amount != null ? Number(row.amount) : undefined,
            description: String(row.description || ""),
            confidence: Number(row.confidence) || confidence,
          };
        })
        .filter((s) => s.account_code)
    : undefined;

  return {
    account_code: code || candidates[0]?.account_code || "6790",
    account_name: String(raw.account_name || candidate?.full_description || accountLabel(code)),
    reasoning: String(raw.reasoning || "Classified from Plan comptable CH candidates."),
    confidence,
    requires_human_review: requires,
    vat_account_code: raw.vat_account_code ? String(raw.vat_account_code) : undefined,
    candidate_codes: candidates.map((c) => c.account_code),
    splits: splits?.length ? splits : undefined,
  };
}

/** Step 3 — Agentic reasoning via Gemini (RAG candidates only, not full 942-account dump). */
export async function classifySwissAccountAgentic(
  extraction: DocumentExtractionForClassification,
  candidates: SwissTaxonomyAccount[],
  signal?: AbortSignal
): Promise<SwissAccountClassification> {
  const candidatesPayload = candidates.map((c) => ({
    code: c.account_code,
    description: c.full_description,
    group: c.parent_group,
  }));

  const prompt = `You are an expert Swiss accountant for paystack.ch (Plan comptable suisse PME).

Classify this business transaction to the SINGLE best 4-digit account code from the candidates below.
Rules:
- Operating expense receipts → classes 4–6 (e.g. 6500 office, 6211 diesel, 4200 goods).
- Fixed asset purchases (machinery, vehicles, IT capitalized) → class 1 (e.g. 1500, 1530, 1521, 1741).
- Revenue → class 3 (e.g. 3200, 3400).
- Swiss VAT deductible on purchases often maps to 1171 (investments) or 1170 (materials) — set vat_account_code when VAT > 0.
- Mixed receipts (office + food): return splits[] with multiple codes instead of one code.
- Private/mixed use (company car private trips): flag requires_human_review true, consider 6270 or 6791.
- Confidence 0.0–1.0; requires_human_review true if confidence < 0.85 or ambiguous.

EXTRACTED DATA:
${JSON.stringify(extraction, null, 2)}

CANDIDATE ACCOUNTS (choose from these only):
${JSON.stringify(candidatesPayload, null, 2)}

Return ONLY JSON:
{
  "account_code": "XXXX",
  "account_name": "label",
  "reasoning": "step-by-step Swiss accounting rationale",
  "confidence": 0.92,
  "requires_human_review": false,
  "vat_account_code": "1171 or null",
  "splits": [{"account_code":"6500","amount":50,"description":"paper"}]
}`;

  const { text } = await generateGeminiContent(
    {
      model: resolveClassifierModel(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    },
    { signal }
  );

  return normalizeClassification(parseClassifierJson(text), candidates);
}

function fallbackClassification(
  extraction: DocumentExtractionForClassification,
  candidates: SwissTaxonomyAccount[]
): SwissAccountClassification {
  const rag = pickSwissAccountRagOnly(extraction);
  const keyword = suggestSwissAccountCode({
    kind: extraction.is_revenue ? "income" : "expense",
    category: extraction.expense_category,
    description: `${extraction.vendor || ""} ${extraction.description || ""}`,
  });
  const code = rag?.account_code || keyword || candidates[0]?.account_code || "6790";
  const confidence = rag?.confidence ?? 0.55;
  return {
    account_code: code,
    account_name: accountLabel(code),
    reasoning: "Keyword/RAG fallback (Gemini classifier unavailable).",
    confidence,
    requires_human_review: true,
    candidate_codes: candidates.map((c) => c.account_code),
  };
}

/** Full pipeline: RAG + agentic Gemini for a parsed document. */
export async function classifyDocumentSwissAccount(
  data: FinancialData,
  signal?: AbortSignal
): Promise<SwissAccountClassification | null> {
  if (data.documentType === "Pay Slip") return null;

  const extraction = buildExtractionFromFinancialData(data);
  const candidates = retrieveRelevantSwissAccounts(extraction, 15);
  if (!candidates.length) return null;

  try {
    return await classifySwissAccountAgentic(extraction, candidates, signal);
  } catch (err) {
    console.warn("[swiss-account-ai] Gemini classification failed, using RAG fallback:", err);
    return fallbackClassification(extraction, candidates);
  }
}

/** Enrich FinancialData after OCR — Step 4 attaches confidence + review flag. */
export async function enrichFinancialDataWithSwissAccount(
  data: FinancialData,
  signal?: AbortSignal
): Promise<FinancialData> {
  const classification = await classifyDocumentSwissAccount(data, signal);
  if (!classification) return data;
  return { ...data, swissAccountClassification: classification };
}

/** Per bank-statement line — RAG only (no extra Gemini). */
export function classifyLineItemAccountCode(input: {
  vendor?: string;
  description: string;
  amount?: number;
  isIncome?: boolean;
}): string | undefined {
  const extraction: DocumentExtractionForClassification = {
    vendor: input.vendor,
    description: input.description,
    amount: input.amount,
    is_revenue: input.isIncome,
    line_items: [{ description: input.description, amount: input.amount }],
  };
  const rag = pickSwissAccountRagOnly(extraction);
  if (rag && rag.confidence >= 0.7) return rag.account_code;
  return suggestSwissAccountCode({
    kind: input.isIncome ? "income" : "expense",
    description: `${input.vendor || ""} ${input.description}`,
  });
}
