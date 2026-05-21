import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { labT, type LabLang } from "../i18n/labStrings";
import { LAB_I18N_KEYS, labTranslationCoverage } from "../i18n/labCoverage";

export function DeItPanel({ feature }: { feature: AliLabFeature }) {
  const { lang, setLang } = useLabLanguage();
  const coverage = labTranslationCoverage(lang);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <div className="flex flex-wrap gap-2 items-center">
        {(["de", "it", "fr", "en"] as LabLang[]).map((l) => {
          const pct = labTranslationCoverage(l).percent;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs font-bold uppercase rounded border ${
                lang === l ? "bg-brand-red text-white border-brand-red" : "border-border"
              }`}
            >
              {l} {l !== "en" ? `· ${pct}%` : ""}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Coverage ({lang})</p>
          <p className="text-2xl font-bold">{coverage.percent}%</p>
          <p className="text-xs text-muted-foreground">
            {coverage.localized}/{coverage.total} keys localized
          </p>
        </div>
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Lab-only</p>
          <p className="text-xs leading-relaxed">
            Strings live in <code>labStrings.ts</code>. Production <code>LanguageContext</code> stays EN/FR until you
            approve promotion in chat.
          </p>
        </div>
      </div>
      {coverage.missing.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Still English fallback: {coverage.missing.slice(0, 8).join(", ")}
          {coverage.missing.length > 8 ? ` +${coverage.missing.length - 8} more` : ""}
        </p>
      )}
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Key</th>
            <th className="text-left p-2">EN</th>
            <th className="text-left p-2">{lang.toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {LAB_I18N_KEYS.map((key) => (
            <tr key={key} className="border-t border-border">
              <td className="p-2 font-mono text-[10px]">{key}</td>
              <td className="p-2 text-muted-foreground">{labT("en", key)}</td>
              <td className="p-2">{labT(lang, key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
