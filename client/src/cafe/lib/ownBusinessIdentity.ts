import { loadSavedInvoices } from "./invoiceStorage";

/** Normalize for fuzzy own-business name matching (accents / punctuation). */
export function normalizeBusinessName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Names that identify the Paystack account holder’s business:
 * Invoice Maker company name(s) + optional Firebase display name.
 */
export function resolveOwnBusinessNames(
  userId: string | undefined,
  displayName?: string | null
): string[] {
  const names = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const t = String(raw || "").trim();
    if (t.length >= 2) names.add(t);
  };
  push(displayName);
  for (const inv of loadSavedInvoices(userId)) {
    push(inv.companyName);
  }
  return Array.from(names);
}

/** True when issuer looks like an invoice issued BY the account’s business (customer invoice → income). */
export function issuerLooksLikeOwnBusiness(
  issuer: string | null | undefined,
  ownNames: string[]
): boolean {
  const iss = normalizeBusinessName(issuer);
  if (iss.length < 3 || ownNames.length === 0) return false;
  return ownNames.some((name) => {
    const nn = normalizeBusinessName(name);
    if (nn.length < 3) return false;
    return iss.includes(nn) || nn.includes(iss);
  });
}

/** Hint block injected into Gemini so customer invoices are not treated as supplier bills. */
export function buildOwnBusinessAiHint(ownNames: string[]): string {
  if (ownNames.length === 0) return "";
  const list = ownNames.map((n) => `"${n}"`).join(", ");
  return (
    `OWN BUSINESS IDENTITY: This Paystack account belongs to ${list}. ` +
    `If the document issuer / letterhead / “from” company matches any of these names ` +
    `(typically top or left of the invoice), classify it as INCOME (customer invoice / sales) ` +
    `with expenseCategory REVENUE — not a supplier expense. ` +
    `If the account holder appears only as the bill-to / recipient (often right side), treat it as EXPENSE.`
  );
}
