import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import type { InvoiceData } from '../types/invoice';
import { buildInvoicePdfBlob, type InvoicePdfLabels } from './invoicePdf';

/** Backs up a sent client invoice to the user's Google Drive, reusing the same document backup
 * pipeline as scanned/uploaded documents. No-ops silently (guest invoices, missing Storage, Drive
 * not connected) — this is best-effort and must never block sending the invoice. Uses a stable
 * per-invoice-number Storage path (rather than the timestamped paths used for scanned documents)
 * so the existing Drive dedupe key stays consistent across repeated sends of the same invoice. */
export async function backupInvoiceToGoogleDrive(
  invoice: InvoiceData,
  labels: InvoicePdfLabels,
  locale: string,
  uid: string | undefined
): Promise<void> {
  if (!uid || !storage) return;

  try {
    const blob = buildInvoicePdfBlob(invoice, labels, locale);
    const sanitizedInvoiceNumber = invoice.invoiceNumber.replace(/[^\w.-]+/g, '_');
    const filename = `${sanitizedInvoiceNumber}.pdf`;
    const storagePath = `documents/${uid}/invoices/${sanitizedInvoiceNumber}.pdf`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    const fileUrl = await getDownloadURL(storageRef);

    const { backupDocumentToGoogleDrive } = await import('./googleDriveClient');
    await backupDocumentToGoogleDrive({
      storagePath,
      fileUrl,
      filename,
      mimeType: 'application/pdf',
      documentDate: invoice.date,
    });
  } catch (error) {
    console.warn('Invoice Drive backup skipped:', error);
  }
}
