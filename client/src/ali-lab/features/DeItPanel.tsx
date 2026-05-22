import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import { labT, type LabLang } from "../i18n/labStrings";
import { LAB_I18N_KEYS, labTranslationCoverage } from "../i18n/labCoverage";
import { LAB_LANG_DISPLAY } from "../i18n/labLangDisplay";

const LAB_LANGS: LabLang[] = ["de", "it", "fr", "en"];

export function DeItPanel({ feature }: { feature: AliLabFeature }) {
  const { lang, setLang, summary, t } = useLabFeatureText(feature);
  const coverage = labTranslationCoverage(lang);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <p className="text-[10px] text-muted-foreground rounded border border-border bg-muted/30 px-2 py-1.5">
        <strong>{t("langDeutsch")}:</strong> {t("langNotDutch")} — ISO <code>de</code> = Deutsch,{" "}
        <code>nl</code> = Niederländisch.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        {LAB_LANGS.map((l) => {
          const pct = labTranslationCoverage(l).percent;
          const label = LAB_LANG_DISPLAY[l];
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              title={l === "de" ? `${label.title} — ${t("langNotDutch")}` : label.title}
              className={`px-3 py-1 text-xs font-bold uppercase rounded border ${
                lang === l ? "bg-brand-red text-white border-brand-red" : "border-border"
              }`}
            >
              {label.short}
              {l !== "en" ? ` · ${pct}%` : ""}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">
            {t("coverage")} ({LAB_LANG_DISPLAY[lang].title})
          </p>
          <p className="text-2xl font-bold">{coverage.percent}%</p>
          <p className="text-xs text-muted-foreground">
            {coverage.localized}/{coverage.total} {t("keysLocalized")}
          </p>
        </div>
        <div className="border border-border rounded p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Lab-only</p>
          <p className="text-xs leading-relaxed">{t("labOnlyDevNote")}</p>
        </div>
      </div>
      {coverage.missing.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t("stillEnglishFallback")} {coverage.missing.slice(0, 8).join(", ")}
          {coverage.missing.length > 8
            ? ` +${coverage.missing.length - 8} ${t("moreKeys")}`
            : ""}
        </p>
      )}
      <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2">Key</th>
            <th className="text-left p-2">EN</th>
            <th className="text-left p-2">{LAB_LANG_DISPLAY[lang].short}</th>
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
