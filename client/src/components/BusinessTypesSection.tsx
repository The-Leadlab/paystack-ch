/*
 * Palette F — "Jet d'Eau" Light Theme
 * Business Types: Industry presets with Geneva Red + Gold accents on light cards.
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import {
  ShoppingBag,
  Utensils,
  Briefcase,
  Laptop,
  Factory,
  Stethoscope,
  GraduationCap,
  ShoppingCart,
} from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function BusinessTypesSection() {
  const { t, language } = useLanguage();

  const businessTypes = useMemo(
    () => [
      { icon: ShoppingBag, name: t("landingBiz1Name"), modules: t("landingBiz1Mods"), description: t("landingBiz1Desc") },
      { icon: Utensils, name: t("landingBiz2Name"), modules: t("landingBiz2Mods"), description: t("landingBiz2Desc") },
      { icon: Briefcase, name: t("landingBiz3Name"), modules: t("landingBiz3Mods"), description: t("landingBiz3Desc") },
      { icon: Laptop, name: t("landingBiz4Name"), modules: t("landingBiz4Mods"), description: t("landingBiz4Desc") },
      { icon: Factory, name: t("landingBiz5Name"), modules: t("landingBiz5Mods"), description: t("landingBiz5Desc") },
      { icon: ShoppingCart, name: t("landingBiz6Name"), modules: t("landingBiz6Mods"), description: t("landingBiz6Desc") },
      { icon: Stethoscope, name: t("landingBiz7Name"), modules: t("landingBiz7Mods"), description: t("landingBiz7Desc") },
      { icon: GraduationCap, name: t("landingBiz8Name"), modules: t("landingBiz8Mods"), description: t("landingBiz8Desc") },
    ],
    [language, t]
  );

  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="04" label={t("landingBizLabel")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("landingBizTitle1")}{" "}
              <span className="text-gradient-red">{t("landingBizTitleHighlight")}</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">{t("landingBizSubtitle")}</p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {businessTypes.map((biz, index) => (
            <ScrollReveal key={biz.name} delay={index * 0.06}>
              <div className="group relative p-5 lg:p-6 rounded-xl border border-border bg-card hover:shadow-lg hover:border-brand-red/15 transition-all duration-500 h-full">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-brand-red/8 transition-colors">
                  <biz.icon size={18} className="text-muted-foreground group-hover:text-brand-red transition-colors" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground mb-2">{biz.name}</h3>
                <p className="font-editorial text-xs text-muted-foreground leading-relaxed mb-3">{biz.description}</p>
                <p className="font-data text-[10px] text-brand-red/60 leading-relaxed">{biz.modules}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
