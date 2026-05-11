/*
 * Palette F — "Jet d'Eau" Light Theme
 * Features: Core features with editorial grid layout. Geneva Red + Gold accents.
 */

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

const features = [
  {
    icon: FileText,
    title: "Traitement IA des documents",
    description:
      "Upload invoices, receipts, bank statements, or payslips in any format. Our AI extracts data with 95%+ accuracy, automatically categorizes entries, and detects duplicates — turning paper into structured financial data in seconds.",
    stats: [
      { label: "Precision", value: "95%+" },
      { label: "Formats", value: "PDF, JPG, PNG" },
      { label: "Traitement", value: "3x parallele" },
    ],
  },
  {
    icon: TrendingUp,
    title: "Suivi des revenus",
    description:
      "Track every revenue stream — from daily sales and service fees to subscriptions and commissions. Automatic income creation from processed documents with real-time dashboard updates and period-based organization.",
    stats: [
      { label: "Categories", value: "Illimitees" },
      { label: "Mises a jour", value: "Temps reel" },
      { label: "Sources", value: "Auto + Manuel" },
    ],
  },
  {
    icon: Wallet,
    title: "Gestion des depenses",
    description:
      "Comprehensive multi-category expense tracking organized by supplier. From rent and utilities to payroll and marketing — every franc is accounted for with automatic expense creation from uploaded documents.",
    stats: [
      { label: "Categories", value: "12+ integrees" },
      { label: "Suivi", value: "Par fournisseur" },
      { label: "Export", value: "Excel + PDF" },
    ],
  },
  {
    icon: Users,
    title: "Paie et salaires",
    description:
      "Process employee payslips with Swiss-format support including AVS, LPP, and AC deductions. Track gross and net salaries, manage deduction breakdowns, and generate monthly payroll summaries automatically.",
    stats: [
      { label: "Format", value: "Suisse (AVS/LPP)" },
      { label: "Deductions", value: "Personnalisables" },
      { label: "Rapports", value: "Mensuels" },
    ],
  },
  {
    icon: Calendar,
    title: "Gestion des sessions et periodes",
    description:
      "Create unlimited accounting periods — daily, weekly, monthly, quarterly, or project-based. Switch between periods instantly, maintain data isolation, and generate period-specific reports for any timeframe.",
    stats: [
      { label: "Periodes", value: "Illimitees" },
      { label: "Types", value: "7+ options" },
      { label: "Bascule", value: "Instantanee" },
    ],
  },
  {
    icon: BarChart3,
    title: "Rapports et analyses",
    description:
      "Monthly revenue analysis, income vs. expense breakdowns, top supplier insights, and advanced filtering. Export print-ready PDF reports or CSV data with complete audit trails for compliance.",
    stats: [
      { label: "Types de rapports", value: "7+" },
      { label: "Filtres", value: "Avances" },
      { label: "Export", value: "CSV + PDF" },
    ],
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="container">
        <SectionLabel number="01" label="Fonctionnalites principales" />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Tout ce qu'il faut pour{" "}
              <span className="font-editorial italic font-normal text-gradient-red">
                gerer vos finances
              </span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              Six modules puissants travaillent ensemble pour automatiser vos operations financieres. Activez seulement les fonctionnalites utiles a votre activite.
            </p>
          </div>
        </ScrollReveal>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 0.08}>
              <div className="group relative h-full p-6 lg:p-8 rounded-xl border border-border bg-card hover:shadow-lg hover:border-brand-red/15 transition-all duration-500">
                {/* Ordinal */}
                <span className="absolute top-6 right-6 font-data text-xs text-border group-hover:text-brand-red/20 transition-colors">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {/* Icon */}
                <div className="w-11 h-11 rounded-lg bg-brand-red/8 flex items-center justify-center mb-5 group-hover:bg-brand-red/12 transition-colors">
                  <feature.icon size={20} className="text-brand-red" />
                </div>

                {/* Content */}
                <h3 className="font-display text-lg font-semibold text-foreground mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="font-editorial text-sm text-muted-foreground leading-relaxed mb-6">
                  {feature.description}
                </p>

                {/* Stats Row */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  {feature.stats.map((stat) => (
                    <div key={stat.label} className="flex-1">
                      <p className="font-data text-xs text-brand-red font-medium">
                        {stat.value}
                      </p>
                      <p className="font-display text-[10px] text-muted-foreground mt-0.5">
                        {stat.label}
                      </p>
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
