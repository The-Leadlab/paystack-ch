/*
 * Palette F — "Jet d'Eau" Light Theme
 * How It Works: Step-by-step process with editorial numbering and AI document scan visual.
 */

import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Upload, Cpu, CheckCircle, FileBarChart } from "lucide-react";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Importer",
    subtitle: "Capturez n'importe quel document",
    description:
      "Snap a photo, upload a PDF, or drag-and-drop any financial document. Invoices, receipts, bank statements, payslips — we handle them all.",
  },
  {
    icon: Cpu,
    number: "02",
    title: "Extraire",
    subtitle: "L'IA lit et comprend",
    description:
      "Our AI engine processes your document with 95%+ OCR accuracy, extracting amounts, dates, vendors, categories, and line items automatically.",
  },
  {
    icon: CheckCircle,
    number: "03",
    title: "Verifier",
    subtitle: "Les donnees sont organisees et validees",
    description:
      "Review extracted data in a clean interface. Edit if needed, approve, and the system automatically categorizes entries into income, expenses, or payroll.",
  },
  {
    icon: FileBarChart,
    number: "04",
    title: "Rapporter",
    subtitle: "Pret a utiliser dans vos systemes",
    description:
      "Access real-time dashboards, generate reports, export to Excel or PDF. Your financial data is structured, searchable, and audit-ready.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="02" label="Comment ca marche" />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Du papier aux{" "}
              <span className="text-gradient-red">donnees structurees</span>
              <br />
              <span className="font-editorial italic font-normal text-[0.8em] text-muted-foreground">
                en quatre etapes simples
              </span>
            </h2>
          </div>
        </ScrollReveal>

        {/* Steps + Visual */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Steps — Left */}
          <div className="lg:col-span-5 space-y-8">
            {steps.map((step, index) => (
              <ScrollReveal key={step.number} delay={index * 0.1}>
                <div className="group flex gap-5">
                  {/* Number + Line */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center group-hover:border-brand-red/30 group-hover:bg-brand-red/5 transition-all duration-500">
                      <step.icon size={20} className="text-brand-red" />
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-px h-full min-h-[40px] bg-border mt-3" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-data text-xs text-brand-red">{step.number}</span>
                      <h3 className="font-display text-lg font-semibold text-foreground tracking-tight">
                        {step.title}
                      </h3>
                    </div>
                    <p className="font-display text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
                      {step.subtitle}
                    </p>
                    <p className="font-editorial text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Visual — Right */}
          <ScrollReveal className="lg:col-span-7" delay={0.2}>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-brand-red-light via-transparent to-brand-gold-light rounded-2xl blur-xl" />
              <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/5">
                <img
                  src="/manus-storage/ai-document-scan_f37e3ac0.png"
                  alt="AI document scanning process — from paper invoice to structured digital data"
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
