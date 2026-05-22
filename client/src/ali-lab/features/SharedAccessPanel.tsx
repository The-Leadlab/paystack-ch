import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabFairSplit, LabMember } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAuth } from "@/cafe/context/AuthContext";
import { useAliLabLedger } from "../hooks/useAliLabLedger";

export function SharedAccessPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const { user } = useAuth();
  const ledger = useAliLabLedger();
  const { items: members, add: addMember, remove: removeMember } = useAliLabPersist<LabMember>(
    labCollections.members,
    "members",
    []
  );
  const { items: splits, add: addSplit, update: updateSplit, remove: removeSplit } = useAliLabPersist<LabFairSplit>(
    labCollections.splits,
    "splits",
    []
  );

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LabMember["role"]>("editor");
  const [splitLabel, setSplitLabel] = useState("");
  const [splitTotal, setSplitTotal] = useState(120);
  const [splitCount, setSplitCount] = useState(2);

  const ownerSeed: LabMember[] = useMemo(
    () => [{ id: "owner", email: user?.email || "owner@lab", role: "owner" as const }],
    [user?.email]
  );

  const displayMembers = members.length > 0 ? members : ownerSeed;

  const recentExpenseTotal = useMemo(() => {
    const last = ledger.filteredExpenses.slice(-5);
    return last.reduce((s, e) => s + e.amount, 0);
  }, [ledger.filteredExpenses]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <p className="text-xs rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
        {t("recentExpensesHint")} <strong>{recentExpenseTotal.toLocaleString("de-CH")} CHF</strong> — {t("useForSplit")}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="border border-border rounded px-2 py-1 flex-1"
          placeholder={t("inviteEmail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="border border-border rounded px-2 py-1 text-xs"
          value={role}
          onChange={(e) => setRole(e.target.value as LabMember["role"])}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
          <option value="accountant">Accountant</option>
        </select>
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!email.trim()) return;
            void addMember({ email: email.trim(), role });
            setEmail("");
          }}
        >
          Invite
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {displayMembers.map((m) => (
          <li key={m.id} className="flex justify-between border border-border rounded px-2 py-1">
            <span>{m.email}</span>
            <span className="flex gap-2 items-center">
              <span className="uppercase text-[10px] font-bold">{m.role}</span>
              {m.role !== "owner" && (
                <button type="button" className="text-[10px] underline" onClick={() => void removeMember(m.id)}>
                  {t("delete")}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="border border-border rounded p-3 space-y-2">
        <p className="text-xs font-bold uppercase">{t("fairSplit")}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            className="border border-border rounded px-2 py-1 flex-1"
            placeholder="Team lunch, supplier invoice…"
            value={splitLabel}
            onChange={(e) => setSplitLabel(e.target.value)}
          />
          <input
            type="number"
            className="border border-border rounded px-2 py-1 w-24"
            value={splitTotal}
            onChange={(e) => setSplitTotal(Number(e.target.value) || 0)}
          />
          <input
            type="number"
            className="border border-border rounded px-2 py-1 w-16"
            min={2}
            value={splitCount}
            onChange={(e) => setSplitCount(Math.max(2, Number(e.target.value) || 2))}
          />
          <button
            type="button"
            className="text-xs font-bold uppercase bg-muted px-2 py-1 rounded"
            onClick={() => setSplitTotal(Math.round(recentExpenseTotal * 100) / 100)}
          >
            From ledger
          </button>
          <button
            type="button"
            className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
            onClick={() => {
              if (!splitLabel.trim()) return;
              void addSplit({
                label: splitLabel.trim(),
                payerEmail: user?.email || "owner@lab",
                totalChf: splitTotal,
                splitCount,
                settled: false,
              });
              setSplitLabel("");
            }}
          >
            {t("addSplit")}
          </button>
        </div>
        <ul className="text-xs space-y-2">
          {splits.length === 0 && <li className="text-muted-foreground">{t("noData")}</li>}
          {splits.map((s) => {
            const per = s.splitCount > 0 ? s.totalChf / s.splitCount : s.totalChf;
            return (
              <li key={s.id} className="flex justify-between items-center border border-border rounded px-2 py-1">
                <span>
                  {s.label}: {s.payerEmail} paid {s.totalChf.toLocaleString("de-CH")} CHF — {t("splitPerPerson")}{" "}
                  {per.toLocaleString("de-CH")} ({s.splitCount} people)
                </span>
                <span className="flex gap-2">
                  {!s.settled && (
                    <button
                      type="button"
                      className="underline font-bold"
                      onClick={() => void updateSplit(s.id, { settled: true })}
                    >
                      {t("markSettled")}
                    </button>
                  )}
                  <span className={s.settled ? "text-emerald-600 uppercase text-[10px]" : "text-amber-600 uppercase text-[10px]"}>
                    {s.settled ? "settled" : "pending"}
                  </span>
                  <button type="button" className="underline" onClick={() => void removeSplit(s.id)}>
                    {t("delete")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
