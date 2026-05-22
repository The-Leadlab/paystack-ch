import type { LabLang } from "./labStrings";

/** UI labels for lab language switchers. `de` = Deutsch (German), NOT Dutch (`nl`). */
export const LAB_LANG_DISPLAY: Record<
  LabLang,
  { short: string; title: string; locale: string }
> = {
  en: { short: "EN", title: "English", locale: "en-CH" },
  fr: { short: "FR", title: "Français", locale: "fr-CH" },
  de: { short: "DE", title: "Deutsch (German)", locale: "de-CH" },
  it: { short: "IT", title: "Italiano", locale: "it-CH" },
};

export function labFormatChf(value: number, lang: LabLang): string {
  const { locale } = LAB_LANG_DISPLAY[lang];
  return `${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
}
