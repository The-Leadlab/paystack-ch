/*
 * Palette F — "Jet d'Eau" Light Theme
 * Pricing: Three-tier pricing with editorial layout. Placeholder pricing pending final decision.
 */

import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";

const plans = [
  {
    name: "Starter",
    price: "29",
    period: "/month",
    description: "For freelancers and solo entrepreneurs getting started with financial automation.",
    features: [
      "Document Processing (50/mo)",
      "Income & Expense Tracking",
      "Basic Reports & Export",
      "1 User",
      "Email Support",
      "2 Accounting Periods",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Business",
    price: "59",
    period: "/month",
    description: "For growing businesses that need full financial management with team access.",
    features: [
      "Document Processing (500/mo)",
      "All Core Modules",
      "Payroll & Salary Management",
      "Advanced Analytics & Reports",
      "Up to 10 Users",
      "Unlimited Periods",
      "Priority Support",
      "API Access",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations requiring custom integrations, SLA, and dedicated support.",
    features: [
      "Unlimited Document Processing",
      "All Modules (Current + Future)",
      "Custom Integrations",
      "White-label Option",
      "Unlimited Users",
      "Dedicated Account Manager",
      "SLA & Uptime Guarantee",
      "On-premise Deployment Option",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function PricingSection() {
  const goToSystem = () => {
    window.location.href = "/app";
  };

  return (
    <section id="pricing" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="06" label="Pricing" />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Simple, transparent{" "}
              <span className="font-editorial italic font-normal text-gradient-gold">pricing</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              All prices in CHF. Start with a 14-day free trial, no credit card required. Scale as your business grows.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <ScrollReveal key={plan.name} delay={index * 0.1}>
              <div
                className={`relative h-full p-6 lg:p-8 rounded-xl border transition-all duration-500 ${
                  plan.highlighted
                    ? "border-brand-red/30 bg-card shadow-lg glow-red"
                    : "border-border bg-card hover:shadow-md hover:border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-brand-red text-white font-display text-xs font-medium">
                    Most Popular
                  </div>
                )}

                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="font-editorial text-sm text-muted-foreground mb-6">
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  {plan.price !== "Custom" && (
                    <span className="font-data text-xs text-muted-foreground">CHF</span>
                  )}
                  <span className="font-display text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="font-display text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  )}
                </div>

                <div className="ruled-line mb-6" />

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check size={14} className="text-brand-red mt-0.5 shrink-0" />
                      <span className="font-display text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={goToSystem}
                  className={`w-full font-display text-sm rounded-lg h-11 gap-2 group ${
                    plan.highlighted
                      ? "bg-brand-red text-white hover:bg-brand-red/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
