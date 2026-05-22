import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { labFeatureCopy } from "../i18n/labRegistryI18n";

export function useLabFeatureText(feature: AliLabFeature) {
  const { lang, t, setLang } = useLabLanguage();
  const copy = labFeatureCopy(feature.id, lang);
  return {
    lang,
    t,
    setLang,
    title: copy?.title ?? feature.title,
    summary: copy?.summary ?? feature.summary,
    promoteTo: copy?.promoteTo ?? feature.promoteTo,
  };
}
