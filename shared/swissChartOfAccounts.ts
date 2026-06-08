import accountsJson from "./data/swissChartOfAccounts.json";

export type SwissAccountEntry = {
  konto: string;
  group: string;
  labelFr: string;
  labelEn: string;
  section: string;
  currency: string;
};

export type SwissAccountLang = "en" | "fr";

/** Swiss SME chart of accounts (Plan comptable CH — PME). Source: shared/data/swissChartOfAccounts.json */
export const SWISS_CHART_OF_ACCOUNTS: SwissAccountEntry[] = accountsJson as SwissAccountEntry[];

const BY_KONTO = new Map(SWISS_CHART_OF_ACCOUNTS.map((a) => [a.konto, a]));

export function getSwissAccount(konto: string | undefined | null): SwissAccountEntry | undefined {
  if (!konto) return undefined;
  return BY_KONTO.get(String(konto).trim());
}

export function swissAccountLabel(entry: SwissAccountEntry, lang: SwissAccountLang): string {
  return lang === "fr" ? entry.labelFr : entry.labelEn;
}

export function formatSwissAccountRef(
  konto: string | undefined | null,
  lang: SwissAccountLang = "fr"
): string {
  const entry = getSwissAccount(konto);
  if (!entry) return konto ? String(konto) : "—";
  return `${entry.konto} · ${swissAccountLabel(entry, lang)}`;
}

export function searchSwissAccounts(
  query: string,
  lang: SwissAccountLang = "fr",
  limit = 12,
  section?: string
): SwissAccountEntry[] {
  const q = query.trim().toLowerCase();
  let pool = section
    ? SWISS_CHART_OF_ACCOUNTS.filter((a) => a.section === section)
    : SWISS_CHART_OF_ACCOUNTS;

  if (!q) {
    return pool.slice(0, limit);
  }

  const scored = pool
    .map((a) => {
      const label = swissAccountLabel(a, lang).toLowerCase();
      const k = a.konto.toLowerCase();
      let score = 0;
      if (k === q) score += 100;
      else if (k.startsWith(q)) score += 80;
      else if (label.includes(q)) score += 40;
      else if (a.labelEn.toLowerCase().includes(q) || a.labelFr.toLowerCase().includes(q)) score += 30;
      else if (a.group === q) score += 20;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.konto.localeCompare(y.a.konto));

  return scored.slice(0, limit).map((x) => x.a);
}

export function listSwissAssetAccounts(limit = 50): SwissAccountEntry[] {
  return SWISS_CHART_OF_ACCOUNTS.filter(
    (a) => /^\d{4}$/.test(a.konto) && Number(a.konto) >= 1000 && Number(a.konto) <= 1799
  ).slice(0, limit);
}
