import { useEffect, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabOfflineQueueItem } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useDocuments } from "@/cafe/context/DocumentContext";

export function OfflinePanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const { documents, loading: docsLoading, refreshDocuments } = useDocuments();
  const { items: queue, add, update, remove, uid } = useAliLabPersist<LabOfflineQueueItem>(
    labCollections.offline,
    "offline-queue",
    []
  );
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const [onlineState, setOnlineState] = useState(online);

  useEffect(() => {
    const on = () => setOnlineState(true);
    const off = () => setOnlineState(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const enqueue = () => {
    void add({
      fileName: `receipt-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.jpg`,
      queuedAt: new Date().toISOString(),
      status: "queued",
    });
  };

  const flush = async () => {
    for (const q of queue) {
      if (q.status === "queued") await update(q.id, { status: "synced" });
    }
    if (uid) await refreshDocuments();
  };

  const queuedCount = queue.filter((q) => q.status === "queued").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">{t("network")}</p>
          <p className={`font-bold ${onlineState ? "text-emerald-600" : "text-red-500"}`}>
            {onlineState ? "online" : "offline"}
          </p>
        </div>
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">/app documents</p>
          <p className="font-bold">
            {docsLoading ? "…" : documents.length} {t("inLibrary")}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="text-xs font-bold uppercase bg-muted px-3 py-1 rounded" onClick={enqueue}>
          Simulate capture
        </button>
        <button
          type="button"
          className="text-xs font-bold uppercase bg-brand-red text-white px-3 py-1 rounded"
          onClick={() => void flush()}
          disabled={!onlineState || queuedCount === 0}
        >
          Flush queue ({queuedCount})
        </button>
      </div>
      <p className="text-xs font-bold uppercase">{t("offlineQueue")}</p>
      <ul className="text-sm space-y-1">
        {queue.length === 0 && <li className="text-muted-foreground">{t("noData")}</li>}
        {queue.map((q) => (
          <li key={q.id} className="flex justify-between border border-border rounded px-2 py-1">
            <span>
              {q.fileName}
              <span className="text-[10px] text-muted-foreground ml-2">{q.queuedAt.slice(0, 16)}</span>
            </span>
            <span className="flex gap-2 items-center">
              <span className={`uppercase text-[10px] ${q.status === "synced" ? "text-emerald-600" : ""}`}>
                {q.status}
              </span>
              <button type="button" className="text-[10px] underline" onClick={() => void remove(q.id)}>
                {t("delete")}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Production: service worker + IndexedDB feeding DocumentProcessor. Lab queue syncs to Firestore when signed in.
      </p>
    </div>
  );
}
