/*
 * Palette F — "Jet d'Eau" Light Theme
 * Features: Core features with editorial grid layout. Geneva Red + Gold accents.
 */

import { useMemo } from "react";
import {
  FileText,
  TrendingUp,
  Wallet,
  Users,
  Calendar,
  BarChart3,
} from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function FeaturesSection() {
  const { t, language } = useLanguage();

  const features = useMemo(
    () => [
      {
        icon: FileText,
        title: t("landingFeat1Title"),
        description: t("landingFeat1Desc"),
        stats: [
          { label: t("landingFeat1S1L"), value: t("landingFeat1S1V") },
          { label: t("landingFeat1S2L"), value: t("landingFeat1S2V") },
          { label: t("landingFeat1S3L"), value: t("landingFeat1S3V") },
        ],
      },
      {
        icon: TrendingUp,
        title: t("landingFeat2Title"),
        description: t("landingFeat2Desc"),
        stats: [
          { label: t("landingFeat2S1L"), value: t("landingFeat2S1V") },
          { label: t("landingFeat2S2L"), value: t("landingFeat2S2V") },
          { label: t("landingFeat2S3L"), value: t("landingFeat2S3V") },
        ],
      },
      {
        icon: Wallet,
        title: t("landingFeat3Title"),
        description: t("landingFeat3Desc"),
        stats: [
          { label: t("landingFeat3S1L"), value: t("landingFeat3S1V") },
          { label: t("landingFeat3S2L"), value: t("landingFeat3S2V") },
          { label: t("landingFeat3S3L"), value: t("landingFeat3S3V") },
        ],
      },
      {
        icon: Users,
        title: t("landingFeat4Title"),
        description: t("landingFeat4Desc"),
        stats: [
          { label: t("landingFeat4S1L"), value: t("landingFeat4S1V") },
          { label: t("landingFeat4S2L"), value: t("landingFeat4S2V") },
          { label: t("landingFeat4S3L"), value: t("landingFeat4S3V") },
        ],
      },
      {
        icon: Calendar,
        title: t("landingFeat5Title"),
        description: t("landingFeat5Desc"),
        stats: [
          { label: t("landingFeat5S1L"), value: t("landingFeat5S1V") },
          { label: t("landingFeat5S2L"), value: t("landingFeat5S2V") },
          { label: t("landingFeat5S3L"), value: t("landingFeat5S3V") },
        ],
      },
      {
        icon: BarChart3,
        title: t("landingFeat6Title"),
        description: t("landingFeat6Desc"),
        stats: [
          { label: t("landingFeat6S1L"), value: t("landingFeat6S1V") },
          { label: t("landingFeat6S2L"), value: t("landingFeat6S2V") },
          { label: t("landingFeat6S3L"), value: t("landingFeat6S3V") },
        ],
      },
    ],
    [language, t]
  );

  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionLabel number="01" label={t("landingSection01Label")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("landingFeaturesTitle1")}{" "}
              <span className="font-editorial italic font-normal text-gradient-red">{t("landingFeaturesTitleItalic")}</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">{t("landingFeaturesSubtitle")}</p>
          </div>
        </ScrollReveal>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.08}>
              <div className="group relative h-full p-6 lg:p-8 rounded-xl border border-border bg-card hover:shadow-lg hover:border-brand-red/15 transition-all duration-500">
                <span className="absolute top-6 right-6 font-data text-xs text-border group-hover:text-brand-red/20 transition-colors">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="w-11 h-11 rounded-lg bg-brand-red/8 flex items-center justify-center mb-5 group-hover:bg-brand-red/12 transition-colors">
                  <feature.icon size={20} className="text-brand-red" />
                </div>

                <h3 className="font-display text-lg font-semibold text-foreground mb-3 tracking-tight">{feature.title}</h3>
                <p className="font-editorial text-sm text-muted-foreground leading-relaxed mb-6">{feature.description}</p>

                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  {feature.stats.map((stat) => (
                    <div key={stat.label} className="flex-1">
                      <p className="font-data text-xs text-brand-red font-medium">{stat.value}</p>
                      <p className="font-display text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
