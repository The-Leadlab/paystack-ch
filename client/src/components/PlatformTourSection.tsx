/*
 * Palette F — "Jet d'Eau" Light Theme
 * Platform Tour: Tabbed showcase of real platform screenshots.
 * Dashboard, Revenue & Z-Readings, Reports, Documents views.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { LandingScreenshot } from "./LandingScreenshot";
import type { LandingScreenKey } from "@/const/landingScreens";
import { LayoutDashboard, TrendingUp, BarChart3, FolderOpen } from "lucide-react";

const views: Array<{
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
  screen: LandingScreenKey;
  alt: string;
}> = [
  {
    id: "dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    title: "Financial Overview at a Glance",
    description:
      "See your complete financial picture — revenue, expenses, salaries, and balance — updated in real-time. Upload documents directly, track processing status, and monitor VAT in one unified view.",
    screen: "dashboard",
    alt: "Paystack.ch Dashboard — financial overview with revenue, expenses, salaries, VAT tracking, and document upload queue",
  },
  {
    id: "revenue",
    label: "Revenus et POS",
    icon: TrendingUp,
    title: "Income Tracking & Z-Readings",
    description:
      "Track all revenue streams with auto-generated Z-readings from daily income data. Supports manual entry, photo upload, and AI auto-generation with Swiss VAT calculation (7.7%) and payment split estimation.",
    screen: "revenue",
    alt: "Paystack.ch Revenue module — Z-reading generation with auto-generate, manual entry, and photo upload options",
  },
  {
    id: "reports",
    label: "Rapports",
    icon: BarChart3,
    title: "Monthly Revenue Analysis",
    description:
      "Filter by date range, category, or supplier. View monthly breakdowns of income vs. expenses with balance calculations. Export filtered data as CSV or print-ready PDF reports for your accountant.",
    screen: "reports",
    alt: "Paystack.ch Reports — monthly revenue analysis with income, expenses, and balance breakdown per period",
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderOpen,
    title: "Organized Document Library",
    description:
      "All processed documents organized by supplier, employee, or POS report. See document counts and total amounts per entity at a glance. Search, filter, and drill into any supplier's complete history.",
    screen: "documents",
    alt: "Paystack.ch Document Library — supplier cards showing document counts and total amounts in CHF",
  },
];

export default function PlatformTourSection() {
  const [activeView, setActiveView] = useState("dashboard");

  const current = views.find((v) => v.id === activeView) || views[0];

  return (
    <section id="platform" className="relative py-24 lg:py-32 border-t border-border bg-secondary/30">
      <div className="container">
        <SectionLabel number="05" label="Visite de la plateforme" />

        <ScrollReveal>
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Voyez-la{" "}
              <span className="font-editorial italic font-normal text-gradient-red">
                en action
              </span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              Captures reelles d'un deploiement en production. Pas de maquettes: c'est la plateforme utilisee aujourd'hui par des entreprises suisses.
            </p>
          </div>
        </ScrollReveal>

        {/* Tab Navigation */}
        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap items-center gap-2 mb-10">
            {views.map((view) => (
              <button
                key={view.id}
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

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Screenshot — 8 columns */}
              <div className="lg:col-span-8">
                <div className="relative">
                  {/* Browser chrome mockup */}
                  <div className="bg-brand-charcoal rounded-t-xl px-4 py-3 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-brand-red/80" />
                      <div className="w-3 h-3 rounded-full bg-brand-red/70" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-white/10 rounded-md px-3 py-1 max-w-xs">
                        <span className="font-data text-[11px] text-white/60">cafe-la-place.web.app</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-b-xl overflow-hidden border border-t-0 border-border shadow-xl shadow-black/8">
                    <img
                      src={current.image}
                      alt={current.alt}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {/* Description — 4 columns */}
              <div className="lg:col-span-4 lg:pt-16">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/10 flex items-center justify-center">
                    <current.icon size={20} className="text-brand-red" />
                  </div>
                  <span className="font-data text-xs text-brand-red uppercase tracking-wider">
                    {current.label}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4 tracking-tight">
                  {current.title}
                </h3>
                <p className="font-editorial text-base text-muted-foreground leading-relaxed mb-6">
                  {current.description}
                </p>
                <div className="p-4 rounded-lg bg-brand-red/8 border border-brand-red/20">
                  <p className="font-display text-xs font-medium text-foreground mb-1">
                    Pret pour marque blanche
                  </p>
                  <p className="font-editorial text-xs text-muted-foreground leading-relaxed">
                    Chaque deploiement est personnalise pour votre entreprise - logo, couleurs et domaine. Cet exemple montre un deploiement en direct pour Cafe de la Place.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
