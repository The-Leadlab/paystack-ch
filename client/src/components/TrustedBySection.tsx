/*
 * Palette F — "Jet d'Eau" Light Theme
 * TrustedBy: Thin ruled line separator, industry names, editorial style.
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function TrustedBySection() {
  const { t, language } = useLanguage();

  const industries = useMemo(
    () => [
      t("landingTrustedInd1"),
      t("landingTrustedInd2"),
      t("landingTrustedInd3"),
      t("landingTrustedInd4"),
      t("landingTrustedInd5"),
      t("landingTrustedInd6"),
      t("landingTrustedInd7"),
      t("landingTrustedInd8"),
    ],
    [language, t]
  );

  return (
    <section className="relative py-12 lg:py-16 border-y border-border">
      <div className="container">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <p className="font-display text-xs tracking-widest text-muted-foreground uppercase whitespace-nowrap">{t("landingTrustedLabel")}</p>
            <div className="h-px w-8 bg-border hidden md:block" />
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {industries.map((industry, i) => (
                <span
                  key={industry}
                  className="font-display text-sm text-muted-foreground/70 hover:text-brand-charcoal transition-colors duration-300"
                >
                  {industry}
                  {i < industries.length - 1 && <span className="ml-8 text-border hidden sm:inline">·</span>}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
