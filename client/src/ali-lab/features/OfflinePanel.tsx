import { useEffect, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabOfflineQueueItem } from "../types";

export function OfflinePanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const key = "ali-lab-offline-queue";
  const [queue, setQueue] = useState<LabOfflineQueueItem[]>([]);
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  useEffect(() => {
    try {
      setQueue(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      setQueue([]);
    }
  }, []);

  const persist = (next: LabOfflineQueueItem[]) => {
    setQueue(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  const enqueue = () => {
    persist([
      ...queue,
      {
        id: crypto.randomUUID(),
        fileName: `receipt-${Date.now()}.jpg`,
        queuedAt: new Date().toISOString(),
        status: "queued",
      },
    ]);
  };

  const flush = () => {
    persist(
      queue.map((q) => (q.status === "queued" ? { ...q, status: "synced" as const } : q))
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <p className="text-xs">
        Network: <strong className={online ? "text-emerald-600" : "text-red-500"}>{online ? "online" : "offline"}</strong>
      </p>
      <div className="flex gap-2">
        <button type="button" className="text-xs font-bold uppercase bg-muted px-3 py-1 rounded" onClick={enqueue}>
          Simulate capture
        </button>
        <button
          type="button"
          className="text-xs font-bold uppercase bg-brand-red text-white px-3 py-1 rounded"
          onClick={flush}
          disabled={!online}
        >
          Flush queue (sync)
        </button>
      </div>
      <p className="text-xs font-bold uppercase">{t("offlineQueue")}</p>
      <ul className="text-sm space-y-1">
        {queue.length === 0 && <li className="text-muted-foreground">{t("noData")}</li>}
        {queue.map((q) => (
          <li key={q.id} className="flex justify-between border border-border rounded px-2 py-1">
            <span>{q.fileName}</span>
            <span className="uppercase text-[10px]">{q.status}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Production: service worker + IndexedDB + DocumentProcessor pipeline.</p>
    </div>
  );
}
