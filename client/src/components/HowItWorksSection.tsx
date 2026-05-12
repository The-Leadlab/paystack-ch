/*
 * Palette F — "Jet d'Eau" Light Theme
 * How It Works: Step-by-step process with editorial numbering and AI document scan visual.
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { LandingScreenshot } from "./LandingScreenshot";
import { Upload, Cpu, CheckCircle, FileBarChart } from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function HowItWorksSection() {
  const { t, language } = useLanguage();

  const steps = useMemo(
    () => [
      {
        icon: Upload,
        number: "01",
        title: t("landingHowStep1Title"),
        subtitle: t("landingHowStep1Sub"),
        description: t("landingHowStep1Desc"),
      },
      {
        icon: Cpu,
        number: "02",
        title: t("landingHowStep2Title"),
        subtitle: t("landingHowStep2Sub"),
        description: t("landingHowStep2Desc"),
      },
      {
        icon: CheckCircle,
        number: "03",
        title: t("landingHowStep3Title"),
        subtitle: t("landingHowStep3Sub"),
        description: t("landingHowStep3Desc"),
      },
      {
        icon: FileBarChart,
        number: "04",
        title: t("landingHowStep4Title"),
        subtitle: t("landingHowStep4Sub"),
        description: t("landingHowStep4Desc"),
      },
    ],
    [language, t]
  );

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="02" label={t("landingHowLabel")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("landingHowTitle1")}{" "}
              <span className="text-gradient-red">{t("landingHowTitleHighlight")}</span>
              <br />
              <span className="font-editorial italic font-normal text-[0.8em] text-muted-foreground">{t("landingHowTitleSub")}</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-8">
            {steps.map((step, index) => (
              <ScrollReveal key={step.number} delay={index * 0.1}>
                <div className="group flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center group-hover:border-brand-red/30 group-hover:bg-brand-red/5 transition-all duration-500">
                      <step.icon size={20} className="text-brand-red" />
                    </div>
                    {index < steps.length - 1 && <div className="w-px h-full min-h-[40px] bg-border mt-3" />}
                  </div>

                  <div className="pb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-data text-xs text-brand-red">{step.number}</span>
                      <h3 className="font-display text-lg font-semibold text-foreground tracking-tight">{step.title}</h3>
                    </div>
                    <p className="font-display text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">{step.subtitle}</p>
                    <p className="font-editorial text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="lg:col-span-7" delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-brand-red-light via-transparent to-brand-red-light/70 rounded-2xl blur-xl" />
              <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/5">
                <LandingScreenshot
                  screen="dashboard"
                  alt={t("landingHowScreenshotAlt")}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
