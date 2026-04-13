/**
 * Open the original document in a new browser tab for manual verification.
 * Aligns with Ypsom (blob URL via window.open) and supports persisted fileDataUrl / data: URLs.
 */
export function openDocumentInNewTab(doc: {
  fileDataUrl?: string;
  fileRaw?: File;
}): void {
  const url = doc.fileDataUrl || (doc.fileRaw ? URL.createObjectURL(doc.fileRaw) : null);
  if (!url) {
    alert('Document file not available. The file may not have been stored with this document.');
    return;
  }

  if (url.startsWith('data:')) {
    try {
      const arr = url.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      console.error('Error opening document:', err);
      alert('Error opening document. The file may be corrupted.');
    }
    return;
  }

  window.open(url, '_blank');
  if (doc.fileRaw && url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
