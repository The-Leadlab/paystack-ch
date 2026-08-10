/**
 * Rasterize PDF pages to JPEG Files for per-receipt AI analysis.
 * Used for multi-page ticket/receipt sheets (e.g. Ticket février.pdf).
 */
import * as pdfjs from "pdfjs-dist";

// Vite: bundle the worker next to the module.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MAX_RENDER_EDGE = 2200;
const JPEG_QUALITY = 0.86;

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function getPdfPageCount(file: File): Promise<number> {
  if (!isPdfFile(file)) return 1;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    return Math.max(1, doc.numPages || 1);
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}

/**
 * True for multi-page POS ticket / receipt binders that should be split to images.
 */
export function shouldSplitPdfToPageImages(
  file: File,
  pageCount: number,
  userHint?: string,
  force = false
): boolean {
  if (!isPdfFile(file) || pageCount < 2) return false;
  if (force) return true;
  const hay = `${file.name} ${userHint || ""}`.toLowerCase();
  return /ticket|tickets|receipt|recipt|z2|caisse|till\b|pos|fevrier|février|multi[-\s]?ticket|bulk\s*ticket/.test(
    hay
  );
}

async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Could not encode PDF page as JPEG.");
  return new File([blob], fileName, { type: "image/jpeg" });
}

/**
 * Render every PDF page to a JPEG File (page-001.jpg, …).
 */
export async function renderPdfPagesToJpegFiles(
  file: File,
  signal?: AbortSignal
): Promise<File[]> {
  if (!isPdfFile(file)) return [file];

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const base = file.name.replace(/\.pdf$/i, "") || "page";
  const out: File[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const page = await doc.getPage(pageNum);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(2.2, MAX_RENDER_EDGE / Math.max(unscaled.width, unscaled.height));
      const viewport = page.getViewport({ scale: Math.max(1, scale) });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D unavailable for PDF page render.");

      await page.render({ canvasContext: ctx, viewport }).promise;
      const pageFile = await canvasToJpegFile(
        canvas,
        `${base}-p${String(pageNum).padStart(3, "0")}.jpg`
      );
      out.push(pageFile);
      page.cleanup();
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }

  return out;
}
