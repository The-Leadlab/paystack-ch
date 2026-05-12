/*
 * Palette F — "Jet d'Eau" Light Theme
 * Security: Swiss trust copy and data protection feature grid (no badge image).
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Shield, Lock, Eye, Server, RefreshCw, Globe } from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function SecuritySection() {
  const { t, language } = useLanguage();

  const securityFeatures = useMemo(
    () => [
      { icon: Lock, title: t("landingSec1Title"), description: t("landingSec1Desc") },
      { icon: Shield, title: t("landingSec2Title"), description: t("landingSec2Desc") },
      { icon: Eye, title: t("landingSec3Title"), description: t("landingSec3Desc") },
      { icon: Server, title: t("landingSec4Title"), description: t("landingSec4Desc") },
      { icon: RefreshCw, title: t("landingSec5Title"), description: t("landingSec5Desc") },
      { icon: Globe, title: t("landingSec6Title"), description: t("landingSec6Desc") },
    ],
    [language, t]
  );

  return (
    <section id="security" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="07" label={t("landingSecurityLabel")} />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <ScrollReveal className="lg:col-span-4">
            <div className="flex flex-col items-start text-left">
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-foreground">
                {t("landingSecurityTitle1")}{" "}
                <span className="text-gradient-red">{t("landingSecurityTitleHighlight")}</span>
              </h2>
              <p className="font-editorial text-base text-muted-foreground leading-relaxed max-w-sm">{t("landingSecuritySubtitle")}</p>
            </div>
          </ScrollReveal>

          <div className="lg:col-span-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {securityFeatures.map((feature, index) => (
                <ScrollReveal key={feature.title} delay={index * 0.08}>
                  <div className="group p-5 rounded-xl border border-border bg-card hover:shadow-md hover:border-brand-red/15 transition-all duration-500 h-full">
                    <div className="w-9 h-9 rounded-lg bg-brand-red/8 flex items-center justify-center mb-4 group-hover:bg-brand-red/12 transition-colors">
                      <feature.icon size={16} className="text-brand-red" />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="font-editorial text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
