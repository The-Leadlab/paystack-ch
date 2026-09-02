/**
 * User-facing document errors are a small family. Technical `Error.message`
 * stays on the row for tooltips/logs; the table shows a localized sentence.
 */
export type DocumentProcessErrorCode =
  | "source_missing"
  | "network"
  | "timeout"
  | "quota"
  | "save"
  | "ai"
  | "page_limit";

export const DOCUMENT_PROCESS_ERROR_I18N: Record<DocumentProcessErrorCode, string> = {
  source_missing: "dpErrSourceMissing",
  network: "dpErrNetwork",
  timeout: "dpErrTimeout",
  quota: "dpErrQuota",
  save: "dpErrSave",
  ai: "dpErrAi",
  page_limit: "dpErrPageLimit",
};

export function parsePdfPageLimit(technical?: string | null): { pages: number; max: number } | null {
  const m = String(technical || "").match(/PDF_PAGE_LIMIT:(\d+):(\d+)/i);
  if (!m) return null;
  return { pages: Number(m[1]), max: Number(m[2]) };
}

export function classifyDocumentProcessError(raw: unknown): DocumentProcessErrorCode {
  const msg = raw instanceof Error ? raw.message : String(raw || "");
  if (
    /PDF_PAGE_LIMIT|too many pages|page limit|plus de \d+ pages|trop de pages/i.test(msg)
  ) {
    return "page_limit";
  }
  if (
    /missing source|re-attach|reattach|not in memory|no storage url|storage download|fichier source|réattacher|rattacher|plus disponible/i.test(
      msg
    )
  ) {
    return "source_missing";
  }
  if (
    /failed to save|failed to queue|permission-denied|missing or insufficient permissions|n’a pas pu être enregistré|pas pu être enregistré/i.test(
      msg
    )
  ) {
    return "save";
  }
  if (
    /quota|rate limited|\b429\b|resource.?exhausted|too many ai requests|trop de requêtes/i.test(msg)
  ) {
    return "quota";
  }
  if (
    /timed out|timeout|504|function_invocation_timeout|processing timeout|trop de temps|expiré|délai d[’']attente/i.test(
      msg
    )
  ) {
    return "timeout";
  }
  if (
    /cannot reach|failed to fetch|networkerror|econnrefused|err_connection|load failed|offline|impossible de joindre/i.test(
      msg
    )
  ) {
    return "network";
  }
  return "ai";
}

export function isSourceMissingError(raw: unknown): boolean {
  return classifyDocumentProcessError(raw) === "source_missing";
}

export function isPageLimitError(raw: unknown): boolean {
  return classifyDocumentProcessError(raw) === "page_limit";
}

export function formatDocumentProcessError(
  t: (key: string) => string,
  code?: string | null,
  technical?: string | null
): string {
  const family = (code || "") as DocumentProcessErrorCode;
  const key = DOCUMENT_PROCESS_ERROR_I18N[family];
  if (key) {
    const localized = t(key);
    if (localized && localized !== key) {
      if (family === "page_limit") {
        const limit = parsePdfPageLimit(technical) || { pages: 0, max: 7 };
        return localized
          .replace("{pages}", limit.pages > 0 ? String(limit.pages) : "?")
          .replace("{max}", String(limit.max || 7));
      }
      return localized;
    }
  }
  if (technical && technical.trim()) return technical;
  return t("dpErrAi");
}
