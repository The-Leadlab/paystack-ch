import { Link } from "wouter";
import { Plus } from "lucide-react";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { businessAppPath } from "../personalPlanNav";

export function PersonalSessionBar({ month }: { month: string }) {
  const ledger = useLinkedLedger(month);
  const { openTransaction } = usePersonalPlan();

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--pp-outline-variant)] bg-[var(--pp-surface-low)] px-4 md:px-16 py-2 text-xs">
      <label className="flex items-center gap-2 text-[var(--pp-on-surface-variant)]">
        Session
        <select
          className="pp-input px-2 py-1 text-xs max-w-[180px]"
          value={ledger.isAllSessionsView ? "__all__" : ledger.currentSession?.id || ""}
          onChange={(e) => {
            if (e.target.value === "__all__") {
              ledger.setAllSessionsView(true);
              return;
            }
            ledger.setAllSessionsView(false);
            const s = ledger.sessions.find((x) => x.id === e.target.value);
            if (s) ledger.setCurrentSession(s);
          }}
        >
          <option value="__all__">All sessions</option>
          {ledger.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {ledger.sessions.length === 0 ? (
        <Link href={businessAppPath()} className="text-[var(--pp-primary)] font-semibold underline">
          Create a session in Business
        </Link>
      ) : (
        <button
          type="button"
          onClick={openTransaction}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] font-bold"
        >
          <Plus className="size-3.5" />
          Add transaction
        </button>
      )}

      <span className="text-[var(--pp-on-surface-variant)] ml-auto hidden sm:inline">
        {ledger.loading ? "Syncing…" : "Live from Firebase · shared with Business"}
      </span>
    </div>
  );
}
