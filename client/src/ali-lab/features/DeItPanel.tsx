import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { labT, type LabLang } from "../i18n/labStrings";

const LAB_UI_KEYS = [
  "signInHint",
  "month",
  "category",
  "budget",
  "spent",
  "variance",
  "addBill",
  "addGoal",
  "csvUpload",
  "forecast",
  "save",
] as const;

export function DeItPanel({ feature }: { feature: AliLabFeature }) {
  const { lang, setLang } = useLabLanguage();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex gap-2">
        {(["de", "it", "fr", "en"] as LabLang[]).map((l) => (
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
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Key</th>
            <th className="text-left p-2">{lang.toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {LAB_UI_KEYS.map((key) => (
            <tr key={key} className="border-t border-border">
              <td className="p-2 font-mono text-[10px]">{key}</td>
              <td className="p-2">{labT(lang, key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        Lab i18n pack ready for promotion into <code>LanguageContext.tsx</code> (extend type to{" "}
        <code>&apos;en&apos; | &apos;fr&apos; | &apos;de&apos; | &apos;it&apos;</code>).
      </p>
    </div>
  );
}
