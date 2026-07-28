/** Compress an image File to a JPEG data URL suitable for local bill receipts. */

export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.72
): Promise<{ dataUrl: string; fileName: string }> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|gif)$/i.test(file.name)) {
    throw new Error("Please choose a photo (JPG or PNG).");
  }

  // HEIC often unsupported in canvas — try anyway; caller shows error.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (dataUrl.length > 900_000) {
    return fileToCompressedDataUrl(file, Math.round(maxEdge * 0.75), quality * 0.85);
  }
  return { dataUrl, fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
}
