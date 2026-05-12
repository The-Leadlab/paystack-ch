/*
 * Palette F — "Jet d'Eau" Light Theme
 * Roadmap: Timeline showing implementation phases with editorial styling.
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Check, Loader2, Clock, Sparkles } from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function RoadmapSection() {
  const { t, language } = useLanguage();

  const phases = useMemo(
    () => [
      {
        icon: Check,
        status: "complete",
        label: t("landingRoadP1Label"),
        title: t("landingRoadP1Title"),
        items: [t("landingRoadP1I1"), t("landingRoadP1I2"), t("landingRoadP1I3"), t("landingRoadP1I4"), t("landingRoadP1I5")],
        color: "text-emerald-600",
        borderColor: "border-emerald-500/30",
        bgColor: "bg-emerald-500/10",
      },
      {
        icon: Loader2,
        status: "progress",
        label: t("landingRoadP2Label"),
        title: t("landingRoadP2Title"),
        items: [t("landingRoadP2I1"), t("landingRoadP2I2"), t("landingRoadP2I3"), t("landingRoadP2I4")],
        color: "text-brand-red",
        borderColor: "border-brand-red/30",
        bgColor: "bg-brand-red/10",
      },
      {
        icon: Clock,
        status: "planned",
        label: t("landingRoadP3Label"),
        title: t("landingRoadP3Title"),
        items: [t("landingRoadP3I1"), t("landingRoadP3I2"), t("landingRoadP3I3"), t("landingRoadP3I4")],
        color: "text-brand-red",
        borderColor: "border-brand-red/30",
        bgColor: "bg-brand-red/10",
      },
      {
        icon: Sparkles,
        status: "future",
        label: t("landingRoadP4Label"),
        title: t("landingRoadP4Title"),
        items: [t("landingRoadP4I1"), t("landingRoadP4I2"), t("landingRoadP4I3"), t("landingRoadP4I4")],
        color: "text-muted-foreground",
        borderColor: "border-border",
        bgColor: "bg-secondary",
      },
    ],
    [language, t]
  );

  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="09" label={t("landingRoadmapLabel")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("landingRoadmapTitle1")}{" "}
              <span className="text-gradient-red">{t("landingRoadmapTitleHighlight")}</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">{t("landingRoadmapSubtitle")}</p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {phases.map((phase, index) => (
            <ScrollReveal key={phase.label} delay={index * 0.1}>
              <div className={`relative h-full p-6 rounded-xl border ${phase.borderColor} bg-card`}>
                <div className={`w-10 h-10 rounded-lg ${phase.bgColor} flex items-center justify-center mb-4`}>
                  <phase.icon size={18} className={`${phase.color} ${phase.status === "progress" ? "animate-spin" : ""}`} />
                </div>

                <span className={`font-data text-xs ${phase.color} mb-1 block`}>{phase.label}</span>
                <h3 className="font-display text-lg font-semibold text-foreground mb-4 tracking-tight">{phase.title}</h3>

                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${phase.bgColor}`} />
                      <span className="font-display text-xs text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
