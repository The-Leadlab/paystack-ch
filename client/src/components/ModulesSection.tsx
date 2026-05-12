/*
 * Palette F — "Jet d'Eau" Light Theme
 * Modules: Showcase modular architecture with toggle concept. Geneva Red + Gold accents.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { LandingScreenshot } from "./LandingScreenshot";
import {
  FileText,
  TrendingUp,
  Wallet,
  Users,
  Calendar,
  BarChart3,
  Archive,
  ShoppingCart,
  Package,
  UserCheck,
  Building2,
  Receipt,
} from "lucide-react";
import { useLanguage } from "@/cafe/context/LanguageContext";

type ModuleItem = {
  icon: typeof FileText;
  name: string;
  status: "live" | "partial" | "coming";
  description: string;
};

export default function ModulesSection() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("core");

  const modules = useMemo(
    () => [
      {
        id: "core",
        label: t("landingModulesTabCore"),
        items: [
          { icon: FileText, name: t("landingModCore1Name"), status: "live" as const, description: t("landingModCore1Desc") },
          { icon: TrendingUp, name: t("landingModCore2Name"), status: "live" as const, description: t("landingModCore2Desc") },
          { icon: Wallet, name: t("landingModCore3Name"), status: "live" as const, description: t("landingModCore3Desc") },
          { icon: Users, name: t("landingModCore4Name"), status: "live" as const, description: t("landingModCore4Desc") },
          { icon: Calendar, name: t("landingModCore5Name"), status: "live" as const, description: t("landingModCore5Desc") },
          { icon: BarChart3, name: t("landingModCore6Name"), status: "live" as const, description: t("landingModCore6Desc") },
        ],
      },
      {
        id: "enhanced",
        label: t("landingModulesTabEnhanced"),
        items: [
          { icon: Archive, name: t("landingModEnh1Name"), status: "live" as const, description: t("landingModEnh1Desc") },
          { icon: ShoppingCart, name: t("landingModEnh2Name"), status: "partial" as const, description: t("landingModEnh2Desc") },
          { icon: Package, name: t("landingModEnh3Name"), status: "coming" as const, description: t("landingModEnh3Desc") },
          { icon: UserCheck, name: t("landingModEnh4Name"), status: "coming" as const, description: t("landingModEnh4Desc") },
          { icon: Building2, name: t("landingModEnh5Name"), status: "coming" as const, description: t("landingModEnh5Desc") },
          { icon: Receipt, name: t("landingModEnh6Name"), status: "coming" as const, description: t("landingModEnh6Desc") },
        ],
      },
    ],
    [language, t]
  );

  const statusColors = useMemo(
    () =>
      ({
        live: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: t("landingModuleStatusLive") },
        partial: { bg: "bg-brand-red/10", text: "text-brand-red", label: t("landingModuleStatusPartial") },
        coming: { bg: "bg-muted", text: "text-muted-foreground", label: t("landingModuleStatusSoon") },
      }) as Record<ModuleItem["status"], { bg: string; text: string; label: string }>,
    [language, t]
  );

  const activeModules = modules.find((m) => m.id === activeTab)?.items || [];

  return (
    <section id="modules" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="03" label={t("landingModulesLabel")} />

        <ScrollReveal>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
                {t("landingModulesTitle1")}{" "}
                <span className="font-editorial italic font-normal text-gradient-red">{t("landingModulesTitleItalic")}</span>
              </h2>
              <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">{t("landingModulesSubtitle")}</p>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit mb-8">
                {modules.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActiveTab(mod.id)}
                    className={`font-display text-sm px-5 py-2 rounded-md transition-all duration-300 ${
                      activeTab === mod.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  {activeModules.map((item) => {
                    const status = statusColors[item.status];
                    return (
                      <div
                        key={item.name}
                        className="group flex items-start gap-4 p-4 rounded-lg border border-border hover:border-brand-red/15 hover:shadow-sm hover:bg-card transition-all duration-300"
                      >
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:bg-brand-red/8 transition-colors">
                          <item.icon size={18} className="text-muted-foreground group-hover:text-brand-red transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-display text-sm font-medium text-foreground">{item.name}</h4>
                            <span className={`font-data text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
                          </div>
                          <p className="font-editorial text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            <ScrollReveal delay={0.2}>
              <div className="relative lg:sticky lg:top-24">
                <div className="absolute -inset-4 bg-gradient-to-br from-brand-red-light via-transparent to-brand-red-light/60 rounded-2xl blur-xl" />
                <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/5">
                  <LandingScreenshot
                    screen="reports"
                    alt={t("landingModulesScreenshotAlt")}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
