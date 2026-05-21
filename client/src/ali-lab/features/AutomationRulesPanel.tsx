import { useMemo, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabAutomationRule } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { detectCategory } from "@/cafe/services/categoryDetectionService";
import { useAliLabLedger } from "../hooks/useAliLabLedger";

export function AutomationRulesPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const ledger = useAliLabLedger();
  const { items, add, remove, update } = useAliLabPersist<LabAutomationRule>(labCollections.rules, "rules", []);
  const [match, setMatch] = useState("");
  const [category, setCategory] = useState("SUPPLIERS");
  const [testInput, setTestInput] = useState("Migros Lausanne");
  const [testResult, setTestResult] = useState<string | null>(null);

  const sampleDescriptions = useMemo(() => {
    const fromLedger = ledger.filteredExpenses
      .map((e) => e.description)
      .filter(Boolean)
      .slice(0, 8) as string[];
    return fromLedger.length > 0 ? fromLedger : ["Migros Lausanne", "Rent April", "Swisscom invoice"];
  }, [ledger.filteredExpenses]);

  const runTest = (input: string) => {
    const ruleHit = items.find(
      (r) => r.enabled && input.toLowerCase().includes(r.match.toLowerCase())
    );
    if (ruleHit) {
      setTestResult(`Rule → ${ruleHit.category} (${ruleHit.flowType})`);
      return;
    }
    const detected = detectCategory(input, input);
    setTestResult(`Keyword AI fallback → ${detected}`);
  };

  const batchResults = useMemo(() => {
    return sampleDescriptions.map((desc) => {
      const ruleHit = items.find(
        (r) => r.enabled && desc.toLowerCase().includes(r.match.toLowerCase())
      );
      return {
        desc,
        result: ruleHit ? `Rule: ${ruleHit.category}` : `Fallback: ${detectCategory(desc, desc)}`,
      };
    });
  }, [sampleDescriptions, items]);

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
        <button type="button" className="text-xs font-bold uppercase text-brand-red" onClick={() => runTest(testInput)}>
          Run
        </button>
        {testResult && <p className="text-sm">{testResult}</p>}
      </div>
      <div className="border border-border rounded p-3">
        <p className="text-xs font-bold uppercase mb-2">Batch test (live /app descriptions)</p>
        <ul className="text-xs space-y-1">
          {batchResults.map((r) => (
            <li key={r.desc} className="flex justify-between gap-2 border-t border-border/50 pt-1 first:border-0 first:pt-0">
              <span className="truncate text-muted-foreground">{r.desc}</span>
              <span className="font-mono shrink-0">{r.result}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
