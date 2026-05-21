import { useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabAutomationRule } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { detectCategory } from "@/cafe/services/categoryDetectionService";

export function AutomationRulesPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { items, add, remove, update } = useAliLabPersist<LabAutomationRule>(labCollections.rules, "rules", []);
  const [match, setMatch] = useState("");
  const [category, setCategory] = useState("FOOD_SUPPLIES");
  const [testInput, setTestInput] = useState("Migros Lausanne");
  const [testResult, setTestResult] = useState<string | null>(null);

  const runTest = () => {
    const ruleHit = items.find(
      (r) => r.enabled && testInput.toLowerCase().includes(r.match.toLowerCase())
    );
    if (ruleHit) {
      setTestResult(`Rule → ${ruleHit.category} (${ruleHit.flowType})`);
      return;
    }
    const detected = detectCategory(testInput, testInput);
    setTestResult(`Keyword AI fallback → ${detected}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="border border-border rounded px-2 py-1 flex-1 min-w-[120px]"
          placeholder={t("ruleMatch")}
          value={match}
          onChange={(e) => setMatch(e.target.value)}
        />
        <input
          className="border border-border rounded px-2 py-1 w-36"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!match.trim()) return;
            void add({
              match: match.trim(),
              field: "description",
              category,
              flowType: "EXPENSE",
              enabled: true,
            });
            setMatch("");
          }}
        >
          {t("addRule")}
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded px-2 py-1">
            <span className={r.enabled ? "" : "opacity-50 line-through"}>
              IF {r.field} contains &quot;{r.match}&quot; → {r.category}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className="text-[10px] font-bold uppercase"
                onClick={() => void update(r.id, { enabled: !r.enabled })}
              >
                {r.enabled ? "Disable" : "Enable"}
              </button>
              <button type="button" className="text-[10px] underline" onClick={() => void remove(r.id)}>
                {t("delete")}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="border border-border rounded p-3 space-y-2">
        <p className="text-xs font-bold uppercase">{t("testRule")}</p>
        <input
          className="w-full border border-border rounded px-2 py-1 text-sm"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
        />
        <button type="button" className="text-xs font-bold uppercase text-brand-red" onClick={runTest}>
          Run
        </button>
        {testResult && <p className="text-sm">{testResult}</p>}
      </div>
    </div>
  );
}
