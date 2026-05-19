import { MAX_GEMINI_ANALYSIS_BYTES } from "@shared/geminiLimits";

/**
 * Gemini requests send files as base64 inside JSON (~4/3 size inflation).
 * Vercel serverless bodies are capped around 4.5 MB, so large phone photos must be
 * downscaled/compressed before analysis — not rejected at an arbitrary 3 MB cap.
 */

function parsePositiveIntEnv(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Max JSON body to POST /api/gemini/generate (default ~4.2 MB, under Vercel ~4.5 MB). */
export const MAX_GEMINI_PROXY_BODY_BYTES = parsePositiveIntEnv(
  import.meta.env.VITE_GEMINI_MAX_PROXY_BODY_BYTES,
  4_200_000
);

/** Largest file for legacy inline AI path (storage + Files API is used when signed in). */
export const MAX_SOURCE_DOCUMENT_BYTES = parsePositiveIntEnv(
  import.meta.env.VITE_GEMINI_MAX_SOURCE_FILE_BYTES,
  MAX_GEMINI_ANALYSIS_BYTES
);

const JSON_OVERHEAD_BYTES = 120_000;

/** Largest raw file bytes that fit in one proxied Gemini request without compression. */
export function maxRawBytesForGeminiPayload(): number {
  return Math.floor(((MAX_GEMINI_PROXY_BODY_BYTES - JSON_OVERHEAD_BYTES) * 3) / 4);
}

function isCompressibleImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/png" || t === "image/webp") return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

type DrawableImage = ImageBitmap | HTMLImageElement;

async function loadDrawableImage(file: File): Promise<{ source: DrawableImage; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, release: () => bitmap.close() };
    } catch {
      /* Safari / older browsers: fall back to Image + object URL */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image for AI analysis."));
      el.src = url;
    });
    return { source: img, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function compressImageToMaxBytes(file: File, maxBytes: number): Promise<File> {
  const { source, release } = await loadDrawableImage(file);
  try {
    const maxDim = 4096;
    let w = source.width;
    let h = source.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image for AI analysis.");

    const qualities = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48];
    const dimScales = [1, 0.85, 0.72, 0.6];

    for (const dimScale of dimScales) {
      canvas.width = Math.max(1, Math.round(w * dimScale));
      canvas.height = Math.max(1, Math.round(h * dimScale));
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

      for (const q of qualities) {
        const blob = await canvasToJpegBlob(canvas, q);
        if (blob && blob.size <= maxBytes) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
          return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
    }

    throw new Error(
      `Could not reduce "${file.name}" enough for AI processing. Try a smaller photo or export as PDF.`
    );
  } finally {
    release();
  }
}

/**
 * Accept large camera JPEGs/PNG/WebP, compress when needed so the Gemini proxy stays under limits.
 * PDFs are not re-encoded here — they must already fit the payload budget.
 */
export async function prepareDocumentForAi(file: File): Promise<File> {
  if (file.size > MAX_SOURCE_DOCUMENT_BYTES) {
    throw new Error(
      `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). ` +
        `Maximum source size is ${(MAX_SOURCE_DOCUMENT_BYTES / (1024 * 1024)).toFixed(0)} MB.`
    );
  }

  const payloadBudget = maxRawBytesForGeminiPayload();
  if (file.size <= payloadBudget) return file;

  if (isCompressibleImage(file)) {
    const compressed = await compressImageToMaxBytes(file, payloadBudget);
    console.info(
      `📷 Optimized ${file.name} for AI: ${(file.size / (1024 * 1024)).toFixed(1)} MB → ${(compressed.size / (1024 * 1024)).toFixed(1)} MB`
    );
    return compressed;
  }

  throw new Error(
    `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) for a single AI request. ` +
      `Use a file under about ${(payloadBudget / (1024 * 1024)).toFixed(1)} MB, or compress/split PDFs. ` +
      "Photos (JPEG/PNG) are optimized automatically."
  );
}

export function formatMaxUploadHintMb(): string {
  return `${(MAX_SOURCE_DOCUMENT_BYTES / (1024 * 1024)).toFixed(0)}`;
}

export function formatMaxStorageUploadHintMb(): string {
  return "no limit";
}

export function formatMaxGeminiAnalysisHintMb(): string {
  return `${(MAX_GEMINI_ANALYSIS_BYTES / (1024 * 1024)).toFixed(0)}`;
}
