import { useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabGoal } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useAliLabLedger } from "../hooks/useAliLabLedger";

export function GoalsPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const { items, add, update, remove } = useAliLabPersist<LabGoal>(labCollections.goals, "goals", []);
  const ledger = useAliLabLedger();
  const surplus = Math.max(0, ledger.balance);

  const [name, setName] = useState("");
  const [targetChf, setTargetChf] = useState(5000);
  const [type, setType] = useState<LabGoal["type"]>("savings");
  const [deadline, setDeadline] = useState("");

  const applySurplus = (goal: LabGoal) => {
    if (surplus <= 0) return;
    const room = Math.max(0, goal.targetChf - goal.currentChf);
    const addAmount = Math.min(surplus, room);
    if (addAmount > 0) void update(goal.id, { currentChf: goal.currentChf + addAmount });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <p className="text-xs rounded border border-border bg-muted/30 px-3 py-2">
        Available surplus from live ledger: <strong>{surplus.toLocaleString("de-CH")} CHF</strong>
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="border border-border rounded px-2 py-1 flex-1 min-w-[140px]"
          placeholder={t("goalName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          className="border border-border rounded px-2 py-1 w-28"
          value={targetChf}
          onChange={(e) => setTargetChf(Number(e.target.value))}
        />
        <input
          type="date"
          className="border border-border rounded px-2 py-1"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          title="Deadline"
        />
        <select
          className="border border-border rounded px-2 py-1 text-xs"
          value={type}
          onChange={(e) => setType(e.target.value as LabGoal["type"])}
        >
          <option value="savings">Savings</option>
          <option value="debt">Debt payoff</option>
        </select>
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!name.trim()) return;
            void add({
              name: name.trim(),
              targetChf,
              currentChf: 0,
              type,
              deadline: deadline || undefined,
            });
            setName("");
            setDeadline("");
          }}
        >
          {t("addGoal")}
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((g) => {
          const pct = g.targetChf > 0 ? Math.min(100, Math.round((g.currentChf / g.targetChf) * 100)) : 0;
          const daysLeft = g.deadline
            ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)
            : null;
          return (
            <li key={g.id} className="border border-border rounded p-3">
              <div className="flex justify-between text-sm font-medium">
                <span>
                  {g.name}{" "}
                  <span className="text-[10px] uppercase text-muted-foreground">{g.type}</span>
                </span>
                <span>
                  {g.currentChf.toLocaleString("de-CH")} / {g.targetChf.toLocaleString("de-CH")} CHF ({pct}%)
                </span>
              </div>
              {g.deadline && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Deadline {g.deadline}
                  {daysLeft != null && (daysLeft >= 0 ? ` · ${daysLeft} days left` : " · overdue")}
                </p>
              )}
              <div className="h-2 bg-muted rounded mt-2 overflow-hidden">
                <div className="h-full bg-brand-red transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="text-xs underline text-muted-foreground"
                  onClick={() => void update(g.id, { currentChf: g.currentChf + 500 })}
                >
                  +500 CHF
                </button>
                <button
                  type="button"
                  className="text-xs underline text-brand-red font-bold"
                  disabled={surplus <= 0 || g.currentChf >= g.targetChf}
                  onClick={() => applySurplus(g)}
                >
                  {t("fundFromSurplus")}
                </button>
                <button type="button" className="text-xs underline text-red-500" onClick={() => void remove(g.id)}>
                  {t("delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
