/*
 * Palette F — "Jet d'Eau" Light Theme
 * Mobile: Upcoming mobile app — copy and feature cards (no hero image).
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Smartphone, Camera, Bell, Wifi } from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function MobileSection() {
  const { t, language } = useLanguage();

  const mobileFeatures = useMemo(
    () => [
      { icon: Camera, label: t("landingMobileF1Label"), description: t("landingMobileF1Desc") },
      { icon: Bell, label: t("landingMobileF2Label"), description: t("landingMobileF2Desc") },
      { icon: Wifi, label: t("landingMobileF3Label"), description: t("landingMobileF3Desc") },
      { icon: Smartphone, label: t("landingMobileF4Label"), description: t("landingMobileF4Desc") },
    ],
    [language, t]
  );

  return (
    <section className="relative py-24 lg:py-32 border-t border-border overflow-hidden">
      <div className="container">
        <SectionLabel number="08" label={t("landingMobileLabel")} />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          <div className="lg:col-span-10 lg:col-start-2">
            <ScrollReveal>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
                {t("landingMobileTitle1")}{" "}
                <span className="font-editorial italic font-normal text-gradient-red">{t("landingMobileTitleItalic")}</span>
              </h2>
              <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">{t("landingMobileSubtitle")}</p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-4">
              {mobileFeatures.map((feature, index) => (
                <ScrollReveal key={feature.label} delay={index * 0.1}>
                  <div className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm hover:border-brand-red/15 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0 group-hover:bg-brand-red/12 transition-colors">
                      <feature.icon size={18} className="text-brand-red" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-medium text-foreground mb-1">{feature.label}</h4>
                      <p className="font-editorial text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.4}>
              <div className="mt-8 flex items-center gap-4">
                <Button
                  size="lg"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-6 h-11 text-sm"
                >
                  {t("landingMobileCta")}
                </Button>
                <span className="font-data text-xs text-muted-foreground">{t("landingMobileTarget")}</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
