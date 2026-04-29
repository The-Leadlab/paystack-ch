/*
 * Palette F — "Jet d'Eau" Light Theme
 * Modules: Showcase modular architecture with toggle concept. Geneva Red + Gold accents.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
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
    label: "Core",
    items: [
      { icon: FileText, name: "Document Processing", status: "live", description: "AI-powered extraction from any document format" },
      { icon: TrendingUp, name: "Income Tracking", status: "live", description: "Multi-category revenue tracking with auto-creation" },
      { icon: Wallet, name: "Expense Management", status: "live", description: "Supplier-based expense organization and categorization" },
      { icon: Users, name: "Payroll & Salary", status: "live", description: "Swiss-format payslip processing with AVS/LPP support" },
      { icon: Calendar, name: "Session Management", status: "live", description: "Unlimited accounting periods with instant switching" },
      { icon: BarChart3, name: "Reports & Analytics", status: "live", description: "Comprehensive financial reports with export options" },
    ],
  },
  {
    id: "enhanced",
    label: "Enhanced",
    items: [
      { icon: Archive, name: "Document Library", status: "live", description: "Entity-based document archiving with search and filter" },
      { icon: ShoppingCart, name: "POS Module", status: "partial", description: "Z-reading entry with AI extraction, full POS coming soon" },
      { icon: Package, name: "Inventory Tracking", status: "coming", description: "Stock management with FIFO/LIFO costing and barcode scanning" },
      { icon: UserCheck, name: "Employee Management", status: "coming", description: "Complete employee profiles, attendance, and leave management" },
      { icon: Building2, name: "Supplier Management", status: "coming", description: "Supplier profiles, payment terms, and performance tracking" },
      { icon: Receipt, name: "Invoice Generation", status: "coming", description: "Custom templates, automatic numbering, and recurring invoices" },
    ],
  },
];

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  live: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Live" },
  partial: { bg: "bg-brand-gold/15", text: "text-amber-600", label: "Partial" },
  coming: { bg: "bg-muted", text: "text-muted-foreground", label: "Coming Soon" },
};

export default function ModulesSection() {
  const [activeTab, setActiveTab] = useState("core");

  const activeModules = modules.find((m) => m.id === activeTab)?.items || [];

  return (
    <section id="modules" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="03" label="Modular Architecture" />

        <ScrollReveal>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left — Content */}
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
                Toggle what you{" "}
                <span className="font-editorial italic font-normal text-gradient-gold">need</span>
              </h2>
              <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Every business is different. Enable only the modules you need — from basic document processing to full enterprise financial management. Scale as you grow.
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
                <div className="absolute -inset-4 bg-gradient-to-br from-brand-gold-light via-transparent to-brand-red-light rounded-2xl blur-xl" />
                <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/5">
                  <img
                    src="/manus-storage/Image28.04.2026at01.15(1)_1cbde1c4.png"
                    alt="Paystack.ch Reports Overview — financial analytics dashboard with income, expenses, and profit tracking"
                    className="w-full h-auto"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <div className="hidden h-[320px] w-full items-center justify-center bg-gradient-to-br from-secondary to-background text-muted-foreground">
                    Reports screenshot unavailable
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
