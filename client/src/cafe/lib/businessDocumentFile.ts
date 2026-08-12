/** Shared accept rules for business Dashboard / Documents uploads (PDF, images, CSV). */

export const BUSINESS_DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/jpg,image/png,image/webp,text/csv,.csv,application/vnd.ms-excel,application/csv";

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

export function isCsvDocumentFile(file: { name: string; type?: string }): boolean {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase().split(";")[0].trim();
  return (
    name.endsWith(".csv") ||
    type === "text/csv" ||
    type === "application/csv" ||
    type === "application/vnd.ms-excel"
  );
}

export function isBusinessDocumentFile(file: { name: string; type?: string }): boolean {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase().split(";")[0].trim();

  if (name.endsWith(".pdf") || type === "application/pdf") return true;
  if (IMAGE_EXT.test(name) || /^image\/(jpeg|jpg|png|webp)$/.test(type)) return true;
  if (isCsvDocumentFile(file)) return true;
  return false;
}

/** Normalize browser MIME quirks (Windows often sends empty or Excel MIME for .csv). */
export function normalizeBusinessDocumentMime(fileName: string, fileType?: string): string {
  const type = (fileType || "").toLowerCase().split(";")[0].trim();
  const lower = (fileName || "").toLowerCase();

  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";

  if (type === "application/csv" || type === "application/vnd.ms-excel") return "text/csv";
  if (type) return type;
  return "application/octet-stream";
}
