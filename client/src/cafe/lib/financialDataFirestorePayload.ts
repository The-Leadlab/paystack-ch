/**
 * Keep Firestore documents under the 1 MiB hard limit by parking large
 * lineItems arrays in Firebase Storage (JSON sidecar).
 */

import type { BankTransaction, FinancialData, ProcessedDocument } from "../types";
import { uploadDocument } from "../services/storageService";

/** Leave headroom for status, fileUrl, metadata, and Firestore encoding overhead. */
export const FIRESTORE_SAFE_PAYLOAD_BYTES = 750_000;
export const LINE_ITEMS_PREVIEW_COUNT = 40;

export function estimateUtf8JsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function financialDataNeedsLineItemsSidecar(data: FinancialData | undefined | null): boolean {
  if (!data) return false;
  const items = Array.isArray(data.lineItems) ? data.lineItems : [];
  if (items.length === 0) return false;
  if (items.length > 150) return true;
  return estimateUtf8JsonBytes(data) > FIRESTORE_SAFE_PAYLOAD_BYTES;
}

function slimFinancialDataForFirestore(data: FinancialData, previewCount = LINE_ITEMS_PREVIEW_COUNT): FinancialData {
  const items = Array.isArray(data.lineItems) ? data.lineItems : [];
  const preview = items.slice(0, previewCount).map((item) => ({
    ...item,
    notes: item.notes ? String(item.notes).slice(0, 120) : undefined,
    description: String(item.description || "").slice(0, 160),
  }));

  return {
    ...data,
    notes: String(data.notes || "").slice(0, 500),
    aiInterpretation: data.aiInterpretation
      ? String(data.aiInterpretation).slice(0, 400)
      : undefined,
    lineItems: preview,
    // Nested invoice payloads can also explode size — drop nested product lines from Firestore.
    subDocuments: Array.isArray(data.subDocuments)
      ? data.subDocuments.map((sub) => ({
          ...sub,
          notes: String(sub.notes || "").slice(0, 300),
          aiInterpretation: sub.aiInterpretation
            ? String(sub.aiInterpretation).slice(0, 300)
            : undefined,
          lineItems: Array.isArray(sub.lineItems)
            ? sub.lineItems.slice(0, 20).map((item) => ({
                ...item,
                notes: item.notes ? String(item.notes).slice(0, 80) : undefined,
                description: String(item.description || "").slice(0, 120),
              }))
            : undefined,
        }))
      : undefined,
  };
}

export type PackedDocumentUpdates = {
  /** Written to Firestore (may omit full lineItems). */
  forFirestore: Partial<ProcessedDocument>;
  /** Merged into React state (keeps full lineItems in memory). */
  forLocal: Partial<ProcessedDocument>;
};

/**
 * If `updates.data.lineItems` would blow the Firestore 1 MiB cap, upload the full
 * array to Storage and keep only a preview + sidecar refs on the Firestore row.
 */
export async function packDocumentUpdatesForFirestore(
  documentId: string,
  ownerUid: string,
  updates: Partial<ProcessedDocument>
): Promise<PackedDocumentUpdates> {
  const data = updates.data;
  if (!data || !financialDataNeedsLineItemsSidecar(data) || !ownerUid) {
    return { forFirestore: updates, forLocal: updates };
  }

  const items = Array.isArray(data.lineItems) ? data.lineItems : [];
  const payload = {
    version: 1 as const,
    documentId,
    count: items.length,
    lineItems: items,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const file = new File([blob], `${documentId}-lineItems.json`, { type: "application/json" });
  const { downloadURL, storagePath } = await uploadDocument(
    file,
    ownerUid,
    `${documentId}_lineItems.json`
  );

  const slimData = slimFinancialDataForFirestore(data);
  const meta = {
    lineItemsStoragePath: storagePath,
    lineItemsUrl: downloadURL,
    lineItemsCount: items.length,
  };

  return {
    forFirestore: {
      ...updates,
      data: slimData,
      ...meta,
    },
    forLocal: {
      ...updates,
      data,
      ...meta,
    },
  };
}

export async function fetchLineItemsFromSidecar(url: string): Promise<BankTransaction[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load line items sidecar (${res.status})`);
  }
  const json = (await res.json()) as { lineItems?: BankTransaction[] } | BankTransaction[];
  if (Array.isArray(json)) return json;
  return Array.isArray(json.lineItems) ? json.lineItems : [];
}

/** Restore full lineItems when Firestore only has a preview + Storage URL. */
export async function hydrateProcessedDocumentLineItems(
  doc: ProcessedDocument
): Promise<ProcessedDocument> {
  const expected = Number(doc.lineItemsCount || 0);
  const current = Array.isArray(doc.data?.lineItems) ? doc.data!.lineItems!.length : 0;
  const url = doc.lineItemsUrl;
  if (!url || !doc.data) return doc;
  if (expected > 0 && current >= expected) return doc;
  // Preview-only: expected unknown but URL set and few items
  if (expected === 0 && current > LINE_ITEMS_PREVIEW_COUNT) return doc;

  try {
    const lineItems = await fetchLineItemsFromSidecar(url);
    if (lineItems.length === 0) return doc;
    return {
      ...doc,
      lineItemsCount: lineItems.length,
      data: {
        ...doc.data,
        lineItems,
      },
    };
  } catch (err) {
    console.warn("Could not hydrate lineItems from Storage:", err);
    return doc;
  }
}

export async function hydrateFinancialDataLineItems(
  data: FinancialData,
  meta?: Pick<ProcessedDocument, "lineItemsUrl" | "lineItemsCount">
): Promise<FinancialData> {
  const expected = Number(meta?.lineItemsCount || 0);
  const current = Array.isArray(data.lineItems) ? data.lineItems.length : 0;
  const url = meta?.lineItemsUrl;
  if (!url) return data;
  if (expected > 0 && current >= expected) return data;
  try {
    const lineItems = await fetchLineItemsFromSidecar(url);
    if (!lineItems.length) return data;
    return { ...data, lineItems };
  } catch (err) {
    console.warn("Could not hydrate FinancialData lineItems:", err);
    return data;
  }
}
