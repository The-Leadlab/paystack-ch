/**
 * Browser download of an uploaded document after AI processing.
 */
export async function downloadDocumentLocally(opts: {
  fileName: string;
  fileUrl?: string;
  fileRaw?: File | Blob;
}): Promise<void> {
  const name = opts.fileName || 'document';
  let blob: Blob | null = opts.fileRaw ?? null;

  if (!blob && opts.fileUrl) {
    const res = await fetch(opts.fileUrl);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    blob = await res.blob();
  }

  if (!blob) return;

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
