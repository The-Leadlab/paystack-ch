/**
 * Rasterize PDF pages to JPEG Files for per-receipt AI analysis.
 * Used for multi-page ticket/receipt sheets (e.g. Ticket février.pdf).
 *
 * Worker loading (critical for production):
 * 1. Prefer same-origin static file `/pdf.worker.min.mjs` (copied into client/public)
 * 2. Fall back to Vite `?url` bundled worker
 * Never use `new URL('pdfjs-dist/...', import.meta.url)` — Vite does not rewrite it → 404 → hang.
 */
import * as pdfjs from "pdfjs-dist";
import pdfWorkerBundledUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const PUBLIC_WORKER = `${import.meta.env.BASE_URL || "/"}pdf.worker.min.mjs`.replace(
  /\/{2,}pdf\.worker/,
  "/pdf.worker"
);

pdfjs.GlobalWorkerOptions.workerSrc = PUBLIC_WORKER;

const MAX_RENDER_EDGE = 2200;
const JPEG_QUALITY = 0.86;
const PAGE_COUNT_TIMEOUT_MS = 15_000;
const RENDER_TIMEOUT_MS = 90_000;

/** Business document PDFs above this are rejected (notify + do not run AI). */
export const MAX_DOCUMENT_PDF_PAGES = 7;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function pdfPageLimitExceeded(pageCount: number): boolean {
  return Number.isFinite(pageCount) && pageCount > MAX_DOCUMENT_PDF_PAGES;
}

/** Stable technical message so the UI can show pages vs max in EN/FR. */
export function pdfPageLimitMessage(pageCount: number): string {
  return `PDF_PAGE_LIMIT:${pageCount}:${MAX_DOCUMENT_PDF_PAGES}`;
}

function ticketReceiptHaystack(file: File, userHint?: string): string {
  return `${file.name} ${userHint || ""}`.toLowerCase();
}

/** Name/hint looks like a multi-ticket / POS receipt binder (no page count needed). */
export function looksLikeMultiTicketPdf(file: File, userHint?: string): boolean {
  if (!isPdfFile(file)) return false;
  return /ticket|tickets|receipt|recipt|z2|caisse|till\b|pos|fevrier|février|multi[-\s]?ticket|bulk\s*ticket/.test(
    ticketReceiptHaystack(file, userHint)
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ensureWorkerSrc(): Promise<void> {
  const current = pdfjs.GlobalWorkerOptions.workerSrc;
  if (current && current !== PUBLIC_WORKER) return;

  // Probe public worker; if missing, switch to Vite-bundled URL.
  try {
    const res = await fetch(PUBLIC_WORKER, { method: "HEAD", cache: "force-cache" });
    if (res.ok) {
      pdfjs.GlobalWorkerOptions.workerSrc = PUBLIC_WORKER;
      return;
    }
  } catch {
    /* fall through */
  }
  console.warn("⚠️ /pdf.worker.min.mjs missing — using bundled worker URL");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBundledUrl;
}

async function loadPdfDocument(data: Uint8Array): Promise<pdfjs.PDFDocumentProxy> {
  await ensureWorkerSrc();
  // Copy buffer — pdf.js may transfer ownership of the TypedArray to the worker.
  const copy = data.slice();
  try {
    return await withTimeout(
      pdfjs.getDocument({ data: copy }).promise,
      PAGE_COUNT_TIMEOUT_MS,
      "PDF.js getDocument"
    );
  } catch (firstErr) {
    // One retry with bundled worker URL (public path may 404 on some hosts).
    if (pdfjs.GlobalWorkerOptions.workerSrc !== pdfWorkerBundledUrl) {
      console.warn("⚠️ PDF.js failed with public worker, retrying bundled worker:", firstErr);
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBundledUrl;
      const copy2 = data.slice();
      return withTimeout(
        pdfjs.getDocument({ data: copy2 }).promise,
        PAGE_COUNT_TIMEOUT_MS,
        "PDF.js getDocument (bundled worker)"
      );
    }
    throw firstErr;
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  if (!isPdfFile(file)) return 1;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await loadPdfDocument(data);
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
  return looksLikeMultiTicketPdf(file, userHint);
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
  const doc = await loadPdfDocument(data);
  const base = file.name.replace(/\.pdf$/i, "") || "page";
  const out: File[] = [];

  try {
    if (pdfPageLimitExceeded(doc.numPages)) {
      throw new Error(pdfPageLimitMessage(doc.numPages));
    }
    const renderAll = async () => {
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
      return out;
    };

    return await withTimeout(renderAll(), RENDER_TIMEOUT_MS, "PDF page rasterize");
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}
