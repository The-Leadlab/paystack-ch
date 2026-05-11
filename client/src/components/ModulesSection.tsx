/*
 * Palette F — "Jet d'Eau" Light Theme
 * Modules: Showcase modular architecture with toggle concept. Geneva Red + Gold accents.
 */

import { useState } from "react";
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

const modules = [
  {
    id: "core",
    label: "Essentiel",
    items: [
      { icon: FileText, name: "Traitement des documents", status: "live", description: "Extraction assistee par IA depuis tout format" },
      { icon: TrendingUp, name: "Suivi des revenus", status: "live", description: "Suivi multi-categories avec creation automatique" },
      { icon: Wallet, name: "Gestion des depenses", status: "live", description: "Classement des depenses par fournisseur" },
      { icon: Users, name: "Paie et salaires", status: "live", description: "Traitement des fiches de paie suisses AVS/LPP" },
      { icon: Calendar, name: "Gestion des sessions", status: "live", description: "Periodes comptables illimitees avec bascule instantanee" },
      { icon: BarChart3, name: "Rapports et analyses", status: "live", description: "Rapports financiers complets avec options d'export" },
    ],
  },
  {
    id: "enhanced",
    label: "Avance",
    items: [
      { icon: Archive, name: "Bibliotheque documents", status: "live", description: "Archivage par entite avec recherche et filtres" },
      { icon: ShoppingCart, name: "Module POS", status: "partial", description: "Saisie Z-reading avec extraction IA, POS complet bientot" },
      { icon: Package, name: "Suivi de stock", status: "coming", description: "Gestion de stock FIFO/LIFO et scan code-barres" },
      { icon: UserCheck, name: "Gestion employes", status: "coming", description: "Profils employes, presence et conges" },
      { icon: Building2, name: "Gestion fournisseurs", status: "coming", description: "Profils fournisseurs, conditions et suivi performance" },
      { icon: Receipt, name: "Generation de factures", status: "coming", description: "Modeles, numerotation automatique et factures recurrentes" },
    ],
  },
];

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  live: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Actif" },
  partial: { bg: "bg-brand-red/10", text: "text-brand-red", label: "Partiel" },
  coming: { bg: "bg-muted", text: "text-muted-foreground", label: "Bientot" },
};

export default function ModulesSection() {
  const [activeTab, setActiveTab] = useState("core");

  const activeModules = modules.find((m) => m.id === activeTab)?.items || [];

  return (
    <section id="modules" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="03" label="Architecture modulaire" />

        <ScrollReveal>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left — Content */}
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
                Activez ce dont vous{" "}
                <span className="font-editorial italic font-normal text-gradient-red">avez besoin</span>
              </h2>
              <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Chaque entreprise est differente. Activez uniquement les modules necessaires, du traitement documentaire a la gestion financiere complete.
              </p>

              {/* Tab Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit mb-8">
                {modules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setActiveTab(mod.id)}
                    className={`font-display text-sm px-5 py-2 rounded-md transition-all duration-300 ${
                      activeTab === mod.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mod.label}
                  </button>
                ))}
              </div>

              {/* Module List */}
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
                            <h4 className="font-display text-sm font-medium text-foreground">
                              {item.name}
                            </h4>
                            <span className={`font-data text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="font-editorial text-xs text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right — Visual */}
            <ScrollReveal delay={0.2}>
              <div className="relative lg:sticky lg:top-24">
                <div className="absolute -inset-4 bg-gradient-to-br from-brand-red-light via-transparent to-brand-red-light/60 rounded-2xl blur-xl" />
                <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/5">
                  <LandingScreenshot
                    screen="reports"
                    alt="Paystack.ch — rapports et analyses financières"
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
