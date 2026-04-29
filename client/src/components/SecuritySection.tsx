/*
 * Palette F — "Jet d'Eau" Light Theme
 * Security: Swiss trust signals, compliance badges, data protection details.
 */

import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Shield, Lock, Eye, Server, RefreshCw, Globe } from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "All data is encrypted in transit and at rest using AES-256 encryption standards.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Granular permissions ensure team members only see what they need to see.",
  },
  {
    icon: Eye,
    title: "Audit Logging",
    description: "Every action is logged with timestamps for complete traceability and compliance.",
  },
  {
    icon: Server,
    title: "Swiss Data Hosting",
    description: "Your financial data stays in Switzerland, compliant with Swiss data protection laws.",
  },
  {
    icon: RefreshCw,
    title: "Automated Backups",
    description: "Continuous backups with disaster recovery ensure your data is never lost.",
  },
  {
    icon: Globe,
    title: "GDPR Compliant",
    description: "Full compliance with European data protection regulations and Swiss FADP.",
  },
];

export default function SecuritySection() {
  return (
    <section id="security" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="07" label="Security & Compliance" />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left — Badge + Trust */}
          <ScrollReveal className="lg:col-span-4">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="w-48 h-48 mb-8">
                <img
                  src="/manus-storage/swiss-trust-badge_68c2163c.png"
                  alt="Swiss Made Data Protection — Precision, Security, Trust"
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div className="hidden h-full w-full items-center justify-center rounded-full border border-border bg-card text-xs text-muted-foreground">
                  Trust badge unavailable
                </div>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-foreground">
                Swiss-grade{" "}
                <span className="text-gradient-red">security</span>
              </h2>
              <p className="font-editorial text-base text-muted-foreground leading-relaxed max-w-sm">
                Your financial data deserves the same level of protection as Swiss banking. We deliver enterprise-grade security with Swiss precision.
              </p>
            </div>
          </ScrollReveal>

          {/* Right — Security Grid */}
          <div className="lg:col-span-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {securityFeatures.map((feature, index) => (
                <ScrollReveal key={feature.title} delay={index * 0.08}>
                  <div className="group p-5 rounded-xl border border-border bg-card hover:shadow-md hover:border-brand-red/15 transition-all duration-500 h-full">
                    <div className="w-9 h-9 rounded-lg bg-brand-red/8 flex items-center justify-center mb-4 group-hover:bg-brand-red/12 transition-colors">
                      <feature.icon size={16} className="text-brand-red" />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="font-editorial text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
