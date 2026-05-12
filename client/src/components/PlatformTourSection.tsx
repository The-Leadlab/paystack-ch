/*
 * Palette F — "Jet d'Eau" Light Theme
 * Platform Tour: Tabbed showcase of real platform screenshots.
 * Dashboard, Revenue & Z-Readings, Reports, Documents views.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { LandingScreenshot } from "./LandingScreenshot";
import type { LandingScreenKey } from "@/const/landingScreens";
import { LayoutDashboard, TrendingUp, BarChart3, FolderOpen } from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function PlatformTourSection() {
  const { t, language } = useLanguage();
  const [activeView, setActiveView] = useState("dashboard");

  const views = useMemo(
    () =>
      [
        {
          id: "dashboard",
          label: t("landingPlatformV1Label"),
          icon: LayoutDashboard,
          title: t("landingPlatformV1Title"),
          description: t("landingPlatformV1Desc"),
          screen: "dashboard" as LandingScreenKey,
          alt: t("landingPlatformV1Alt"),
        },
        {
          id: "revenue",
          label: t("landingPlatformV2Label"),
          icon: TrendingUp,
          title: t("landingPlatformV2Title"),
          description: t("landingPlatformV2Desc"),
          screen: "revenue" as LandingScreenKey,
          alt: t("landingPlatformV2Alt"),
        },
        {
          id: "reports",
          label: t("landingPlatformV3Label"),
          icon: BarChart3,
          title: t("landingPlatformV3Title"),
          description: t("landingPlatformV3Desc"),
          screen: "reports" as LandingScreenKey,
          alt: t("landingPlatformV3Alt"),
        },
        {
          id: "documents",
          label: t("landingPlatformV4Label"),
          icon: FolderOpen,
          title: t("landingPlatformV4Title"),
          description: t("landingPlatformV4Desc"),
          screen: "documents" as LandingScreenKey,
          alt: t("landingPlatformV4Alt"),
        },
      ] as const,
    [language, t]
  );

  const current = views.find((v) => v.id === activeView) || views[0];

  return (
    <section id="platform" className="relative py-24 lg:py-32 border-t border-border bg-secondary/30">
      <div className="container">
        <SectionLabel number="05" label={t("landingPlatformLabel")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("landingPlatformTitle1")}{" "}
              <span className="font-editorial italic font-normal text-gradient-red">{t("landingPlatformTitleItalic")}</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">{t("landingPlatformSubtitle")}</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap items-center gap-2 mb-10">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`flex items-center gap-2 font-display text-sm px-4 py-2.5 rounded-lg transition-all duration-300 ${
                  activeView === view.id
                    ? "bg-brand-charcoal text-white shadow-md"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border hover:border-brand-red/20"
                }`}
              >
                <view.icon size={16} />
                {view.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <div className="lg:col-span-8">
                <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/8">
                  <LandingScreenshot screen={current.screen} alt={current.alt} className="w-full h-auto block" loading="lazy" />
                </div>
              </div>

              <div className="lg:col-span-4 lg:pt-16">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/10 flex items-center justify-center">
                    <current.icon size={20} className="text-brand-red" />
                  </div>
                  <span className="font-data text-xs text-brand-red uppercase tracking-wider">{current.label}</span>
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4 tracking-tight">{current.title}</h3>
                <p className="font-editorial text-base text-muted-foreground leading-relaxed mb-6">{current.description}</p>
                <div className="p-4 rounded-lg bg-brand-red/8 border border-brand-red/20">
                  <p className="font-display text-xs font-medium text-foreground mb-1">{t("landingPlatformWlTitle")}</p>
                  <p className="font-editorial text-xs text-muted-foreground leading-relaxed">{t("landingPlatformWlBody")}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
