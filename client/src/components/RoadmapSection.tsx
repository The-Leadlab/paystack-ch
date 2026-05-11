/*
 * Palette F — "Jet d'Eau" Light Theme
 * Roadmap: Timeline showing implementation phases with editorial styling.
 */

import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Check, Loader2, Clock, Sparkles } from "lucide-react";

const phases = [
  {
    icon: Check,
    status: "complete",
    label: "Phase 1",
    title: "Fonctionnalites essentielles",
    items: ["Traitement des documents", "Suivi revenus/depenses", "Gestion des sessions", "Rapports de base", "Authentification"],
    color: "text-emerald-600",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Loader2,
    status: "progress",
    label: "Phase 2",
    title: "Fonctionnalites ameliorees",
    items: ["Analyses avancees", "Suivi des stocks", "Gestion employes", "Gestion fournisseurs"],
    color: "text-brand-red",
    borderColor: "border-brand-red/30",
    bgColor: "bg-brand-red/10",
  },
  {
    icon: Clock,
    status: "planned",
    label: "Phase 3",
    title: "Fonctionnalites avancees",
    items: ["Gestion clients", "Gestion projets", "Generation de factures", "Applications mobiles"],
    color: "text-brand-red",
    borderColor: "border-brand-red/30",
    bgColor: "bg-brand-red/10",
  },
  {
    icon: Sparkles,
    status: "future",
    label: "Phase 4",
    title: "Fonctionnalites entreprise",
    items: ["Support multi-societes", "Integrations avancees", "Workflows sur mesure", "Marketplace API"],
    color: "text-muted-foreground",
    borderColor: "border-border",
    bgColor: "bg-secondary",
  },
];

export default function RoadmapSection() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="09" label="Feuille de route" />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Construit pour le{" "}
              <span className="text-gradient-red">long terme</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              Notre feuille de route evolue selon les besoins clients. De la gestion financiere essentielle aux fonctions entreprise, nous construisons une plateforme complete.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {phases.map((phase, index) => (
            <ScrollReveal key={phase.label} delay={index * 0.1}>
              <div className={`relative h-full p-6 rounded-xl border ${phase.borderColor} bg-card`}>
                {/* Status Icon */}
                <div className={`w-10 h-10 rounded-lg ${phase.bgColor} flex items-center justify-center mb-4`}>
                  <phase.icon
                    size={18}
                    className={`${phase.color} ${phase.status === "progress" ? "animate-spin" : ""}`}
                  />
                </div>

                <span className={`font-data text-xs ${phase.color} mb-1 block`}>
                  {phase.label}
                </span>
                <h3 className="font-display text-lg font-semibold text-foreground mb-4 tracking-tight">
                  {phase.title}
                </h3>

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
