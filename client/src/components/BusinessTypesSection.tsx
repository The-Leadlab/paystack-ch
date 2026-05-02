/*
 * Palette F — "Jet d'Eau" Light Theme
 * Business Types: Industry presets with Geneva Red + Gold accents on light cards.
 */

import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import {
  ShoppingBag,
  Utensils,
  Briefcase,
  Laptop,
  Factory,
  Stethoscope,
  GraduationCap,
  ShoppingCart,
} from "lucide-react";

const businessTypes = [
  {
    icon: ShoppingBag,
    name: "Commerce de detail",
    modules: "POS, Inventory, Income, Expenses, Suppliers",
    description: "Daily sales tracking, stock management, and supplier organization for retail stores.",
  },
  {
    icon: Utensils,
    name: "Restaurants et cafes",
    modules: "POS, Income, Expenses, Payroll, Suppliers",
    description: "Z-reading processing, daily revenue tracking, and staff payroll management.",
  },
  {
    icon: Briefcase,
    name: "Services professionnels",
    modules: "Income, Expenses, Payroll, Projects, Invoicing",
    description: "Project-based accounting, client billing, and contractor payment management.",
  },
  {
    icon: Laptop,
    name: "Conseil et freelance",
    modules: "Income, Expenses, Clients, Projects, Invoicing",
    description: "Client-specific periods, project profitability tracking, and invoice generation.",
  },
  {
    icon: Factory,
    name: "Industrie",
    modules: "Expenses, Payroll, Inventory, Suppliers, Employees",
    description: "Raw material tracking, production cost analysis, and workforce management.",
  },
  {
    icon: ShoppingCart,
    name: "E-commerce",
    modules: "Income, Expenses, Inventory, Suppliers, Integrations",
    description: "Multi-channel revenue tracking, stock synchronization, and platform integrations.",
  },
  {
    icon: Stethoscope,
    name: "Sante",
    modules: "Income, Expenses, Payroll, Employees, Documents",
    description: "Patient billing, staff management, and compliance-ready document archiving.",
  },
  {
    icon: GraduationCap,
    name: "Education",
    modules: "Income, Expenses, Payroll, Employees, Reports",
    description: "Tuition tracking, staff payroll, and period-based financial reporting.",
  },
];

export default function BusinessTypesSection() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="04" label="Modeles par secteur" />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Configure pour{" "}
              <span className="text-gradient-red">votre secteur</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              Configurations predefinies pour chaque type d'activite. Demarrez avec un modele secteur puis adaptez les modules a votre flux reel.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {businessTypes.map((biz, index) => (
            <ScrollReveal key={biz.name} delay={index * 0.06}>
              <div className="group relative p-5 lg:p-6 rounded-xl border border-border bg-card hover:shadow-lg hover:border-brand-red/15 transition-all duration-500 h-full">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-brand-red/8 transition-colors">
                  <biz.icon size={18} className="text-muted-foreground group-hover:text-brand-red transition-colors" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground mb-2">
                  {biz.name}
                </h3>
                <p className="font-editorial text-xs text-muted-foreground leading-relaxed mb-3">
                  {biz.description}
                </p>
                <p className="font-data text-[10px] text-brand-red/60 leading-relaxed">
                  {biz.modules}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
