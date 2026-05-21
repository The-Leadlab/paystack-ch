import { labT, type LabLang } from "./labStrings";

/** Keys that should have non-English copy before promoting i18n to LanguageContext. */
export const LAB_I18N_KEYS = [
  "signInHint",
  "month",
  "category",
  "budget",
  "spent",
  "variance",
  "zeroBased",
  "traditional",
  "addBill",
  "due",
  "daysUntil",
  "overdue",
  "goalName",
  "target",
  "addGoal",
  "forecast",
  "ruleMatch",
  "addRule",
  "testRule",
  "holding",
  "offlineQueue",
  "inviteEmail",
  "role",
  "save",
  "delete",
  "noData",
  "firebaseOk",
  "localOnly",
] as const;

export type LabI18nKey = (typeof LAB_I18N_KEYS)[number];

export function labTranslationCoverage(lang: LabLang): {
  total: number;
  localized: number;
  percent: number;
  missing: LabI18nKey[];
} {
  const missing: LabI18nKey[] = [];
  for (const key of LAB_I18N_KEYS) {
    const enVal = labT("en", key);
    const val = labT(lang, key);
    if (lang !== "en" && val === enVal) missing.push(key);
  }
  const total = LAB_I18N_KEYS.length;
  const localized = total - missing.length;
  return {
    total,
    localized: lang === "en" ? total : localized,
    percent: lang === "en" ? 100 : Math.round((localized / total) * 100),
    missing,
  };
}
