import { useEffect, useMemo, useState } from "react";
import type { AliLabFeature } from "./featureRegistry";

type PanelProps = { feature: AliLabFeature };

function ScaffoldPanel({ feature }: PanelProps) {
  return (
    <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground mb-2">Scaffold — ready to implement</p>
      <p>{feature.summary}</p>
      <p className="mt-3 text-xs">
        Follow <code className="text-foreground">docs/ALI_LAB_SUPER_PROMPT.md</code> section for{" "}
        <strong>{feature.id}</strong>, then set status to <code>prototype</code> → <code>ready</code> → promote to{" "}
        <code>{feature.promoteTo}</code>.
      </p>
    </div>
  );
}

/** 1 — Budget vs actual (local prototype) */
export function BudgetingPanel({ feature }: PanelProps) {
  const [budgets, setBudgets] = useState(() => [
    { cat: "Food supplies", budget: 12000, spent: 9800 },
    { cat: "Payroll", budget: 45000, spent: 44100 },
    { cat: "Rent", budget: 8500, spent: 8500 },
  ]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Category</th>
            <th className="text-right p-2">Budget CHF</th>
            <th className="text-right p-2">Spent</th>
            <th className="text-right p-2">Variance</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((row, i) => {
            const v = row.budget - row.spent;
            return (
              <tr key={row.cat} className="border-t border-border">
                <td className="p-2">{row.cat}</td>
                <td className="p-2 text-right">
                  <input
                    type="number"
                    className="w-24 text-right bg-background border border-border rounded px-1"
                    value={row.budget}
                    onChange={(e) => {
                      const next = [...budgets];
                      next[i] = { ...row, budget: Number(e.target.value) };
                      setBudgets(next);
                    }}
                  />
                </td>
                <td className="p-2 text-right">{row.spent.toLocaleString("de-CH")}</td>
                <td className={`p-2 text-right font-medium ${v < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {v.toLocaleString("de-CH")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 3 — Goals */
export function GoalsPanel({ feature }: PanelProps) {
  const key = "ali-lab-goals";
  const [goals, setGoals] = useState<{ id: string; name: string; target: number; current: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(goals));
  }, [goals]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(5000);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-2">
        <input
          className="border border-border rounded px-2 py-1 text-sm flex-1 min-w-[140px]"
          placeholder="Goal name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          className="border border-border rounded px-2 py-1 text-sm w-28"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!name.trim()) return;
            setGoals((g) => [...g, { id: crypto.randomUUID(), name, target, current: 0 }]);
            setName("");
          }}
        >
          Add goal
        </button>
      </div>
      <ul className="space-y-2">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          return (
            <li key={g.id} className="border border-border rounded p-3">
              <div className="flex justify-between text-sm font-medium">
                <span>{g.name}</span>
                <span>
                  {g.current} / {g.target} CHF ({pct}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded mt-2 overflow-hidden">
                <div className="h-full bg-brand-red" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground mt-2 underline"
                onClick={() =>
                  setGoals((list) =>
                    list.map((x) => (x.id === g.id ? { ...x, current: x.current + 500 } : x))
                  )
                }
              >
                +500 CHF (demo)
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 5 — Bill reminders */
export function BillRemindersPanel({ feature }: PanelProps) {
  const key = "ali-lab-bills";
  const [bills, setBills] = useState<{ id: string; name: string; due: string; amount: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [
        { id: "1", name: "Serafe", due: "2026-06-01", amount: 335 },
        { id: "2", name: "RC insurance", due: "2026-07-15", amount: 1200 },
      ];
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(bills));
  }, [bills]);

  const upcoming = useMemo(
    () =>
      [...bills].sort((a, b) => a.due.localeCompare(b.due)).filter((b) => b.due >= new Date().toISOString().slice(0, 10)),
    [bills]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <ul className="space-y-2">
        {upcoming.map((b) => (
          <li key={b.id} className="flex justify-between border border-border rounded px-3 py-2 text-sm">
            <span>
              {b.name} — due {b.due}
            </span>
            <span className="font-medium">{b.amount} CHF</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-xs font-bold uppercase text-brand-red"
        onClick={() =>
          setBills((x) => [
            ...x,
            { id: crypto.randomUUID(), name: "New bill", due: "2026-08-01", amount: 0 },
          ])
        }
      >
        + Add reminder (prototype)
      </button>
    </div>
  );
}

/** 8 — DE / IT preview */
export function DeItPanel({ feature }: PanelProps) {
  const samples = {
    de: { title: "Dokumente hochladen", cta: "Verarbeitung starten", budget: "Budgetübersicht" },
    it: { title: "Carica documenti", cta: "Avvia elaborazione", budget: "Panoramica budget" },
    fr: { title: "Télécharger des documents", cta: "Démarrer le traitement", budget: "Aperçu du budget" },
    en: { title: "Upload documents", cta: "Start processing", budget: "Budget overview" },
  };
  const [lang, setLang] = useState<keyof typeof samples>("de");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex gap-2">
        {(["de", "it", "fr", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-3 py-1 text-xs font-bold uppercase rounded border ${
              lang === l ? "bg-brand-red text-white border-brand-red" : "border-border"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="border border-border rounded-lg p-4 bg-card">
        <p className="text-lg font-display">{samples[lang].title}</p>
        <p className="text-sm text-muted-foreground mt-1">{samples[lang].budget}</p>
        <button type="button" className="mt-3 bg-brand-red text-white text-xs font-bold uppercase px-4 py-2 rounded">
          {samples[lang].cta}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Lab preview only — promote by extending <code>LanguageContext</code> type and translation maps.
      </p>
    </div>
  );
}

export function AliLabFeaturePanel({ feature }: PanelProps) {
  switch (feature.id) {
    case "budgeting":
      return <BudgetingPanel feature={feature} />;
    case "goals":
      return <GoalsPanel feature={feature} />;
    case "bill-reminders":
      return <BillRemindersPanel feature={feature} />;
    case "de-it-i18n":
      return <DeItPanel feature={feature} />;
    case "bank-sync":
      return (
        <div className="space-y-4">
          <ScaffoldPanel feature={feature} />
          <p className="text-xs text-muted-foreground">
            Next: bLink sandbox credentials, Firestore <code>bank_connections</code>, sync job to{" "}
            <code>income</code>/<code>expense</code>.
          </p>
        </div>
      );
    default:
      return <ScaffoldPanel feature={feature} />;
  }
}
