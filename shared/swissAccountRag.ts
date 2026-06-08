import taxonomy from "./data/swiss_chart_of_accounts_taxonomy.json";

export type SwissTaxonomyAccount = {
  account_code: string;
  full_description: string;
  bklasse: number;
  parent_group: string;
  currency: string;
  page: number;
};

export type DocumentExtractionForClassification = {
  vendor?: string;
  date?: string;
  amount?: number;
  currency?: string;
  vat_amount?: number;
  vat_rate?: number;
  document_type?: string;
  expense_category?: string;
  description?: string;
  line_items?: Array<{ description: string; amount?: number }>;
  is_revenue?: boolean;
};

const ACCOUNTS = taxonomy.accounts as SwissTaxonomyAccount[];
const CLASSIFICATION_RULES = taxonomy.classification_rules as Record<
  string,
  Record<
    string,
    {
      name?: string;
      keywords_en?: string[];
      keywords_fr?: string[];
      account_range?: string;
    }
  >
>;

const ASSET_KEYWORDS =
  /\b(machine|machinery|vehicle|véhicule|computer|informatique|software|licence|license|equipment|équipement|immobilisation|asset|investment|mobilier|furniture|immeuble|building|warehouse|entrepôt|outil|tool)\b/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function accountClass(code: string): string {
  return code.replace(/\D/g, "").charAt(0) || "0";
}

function inRange(code: string, range: string): boolean {
  const m = range.match(/(\d{4})-(\d{4})/);
  if (!m) return false;
  const n = Number(code);
  return n >= Number(m[1]) && n <= Number(m[2]);
}

function ruleKeywordBoost(searchText: string, code: string): number {
  let boost = 0;
  for (const group of Object.values(CLASSIFICATION_RULES)) {
    for (const rule of Object.values(group)) {
      const keywords = [...(rule.keywords_en || []), ...(rule.keywords_fr || [])];
      const range = rule.account_range;
      const matchesKeyword = keywords.some((k) => searchText.includes(k.toLowerCase()));
      if (!matchesKeyword) continue;
      if (range && inRange(code, range)) boost += 25;
      else if (code.startsWith("4") || code.startsWith("5") || code.startsWith("6")) boost += 8;
    }
  }
  return boost;
}

function scoreAccount(account: SwissTaxonomyAccount, searchText: string, tokens: string[]): number {
  const desc = account.full_description.toLowerCase();
  const descTokens = tokenize(desc);
  let score = 0;

  for (const t of tokens) {
    if (desc.includes(t)) score += 12;
    if (descTokens.some((d) => d.startsWith(t) || t.startsWith(d))) score += 6;
  }

  if (account.account_code && searchText.includes(account.account_code)) score += 100;
  score += ruleKeywordBoost(searchText, account.account_code);
  return score;
}

function allowedPrefixes(extraction: DocumentExtractionForClassification): string[] {
  const text = `${extraction.vendor || ""} ${extraction.description || ""} ${extraction.expense_category || ""}`;
  const prefixes: string[] = [];

  if (extraction.is_revenue) {
    prefixes.push("3");
    return prefixes;
  }

  if (ASSET_KEYWORDS.test(text)) {
    prefixes.push("1");
  }

  prefixes.push("4", "5", "6");
  return prefixes;
}

/** Step 2 — RAG: top N Plan comptable candidates for agentic classification. */
export function retrieveRelevantSwissAccounts(
  extraction: DocumentExtractionForClassification,
  limit = 15
): SwissTaxonomyAccount[] {
  const parts = [
    extraction.vendor,
    extraction.description,
    extraction.expense_category,
    extraction.document_type,
    ...(extraction.line_items || []).map((l) => l.description),
  ].filter(Boolean);
  const searchText = parts.join(" ").toLowerCase();
  const tokens = tokenize(searchText);
  const prefixes = allowedPrefixes(extraction);

  const scored = ACCOUNTS.map((account) => {
    const cls = accountClass(account.account_code);
    if (!prefixes.includes(cls)) return { account, score: 0 };
    const score = scoreAccount(account, searchText, tokens);
    return { account, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.account.account_code.localeCompare(b.account.account_code));

  if (scored.length >= limit) return scored.slice(0, limit).map((x) => x.account);

  const fallback = ACCOUNTS.filter((a) => {
    const cls = accountClass(a.account_code);
    return prefixes.includes(cls);
  }).slice(0, limit);

  const seen = new Set<string>();
  const out: SwissTaxonomyAccount[] = [];
  for (const x of scored) {
    if (seen.has(x.account.account_code)) continue;
    seen.add(x.account.account_code);
    out.push(x.account);
    if (out.length >= limit) return out;
  }
  for (const a of fallback) {
    if (seen.has(a.account_code)) continue;
    seen.add(a.account_code);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildExtractionFromFinancialData(data: {
  documentType?: string;
  date?: string;
  issuer?: string;
  totalAmount?: number;
  originalCurrency?: string;
  vatAmount?: number;
  vatRate?: number;
  expenseCategory?: string;
  notes?: string;
  lineItems?: Array<{ description?: string; amount?: number; type?: string }>;
}): DocumentExtractionForClassification {
  const cat = String(data.expenseCategory || "").toUpperCase();
  const isRevenue =
    cat.includes("REVENUE") ||
    cat.includes("SALES") ||
    data.documentType === "Ticket/Receipt" ||
    data.documentType === "Z2 Multi-Ticket Sheet";

  return {
    vendor: data.issuer,
    date: data.date,
    amount: data.totalAmount,
    currency: data.originalCurrency || "CHF",
    vat_amount: data.vatAmount,
    vat_rate: data.vatRate,
    document_type: data.documentType,
    expense_category: data.expenseCategory,
    description: data.notes || data.issuer,
    line_items: (data.lineItems || [])
      .filter((l) => l.description)
      .map((l) => ({ description: l.description!, amount: l.amount })),
    is_revenue: isRevenue,
  };
}

/** Fast RAG-only pick (bank line items) — no extra Gemini call. */
export function pickSwissAccountRagOnly(
  extraction: DocumentExtractionForClassification
): { account_code: string; confidence: number } | null {
  const top = retrieveRelevantSwissAccounts(extraction, 3);
  if (!top.length) return null;
  const best = top[0];
  const second = top[1];
  const confidence = second ? 0.72 : 0.8;
  return { account_code: best.account_code, confidence };
}
