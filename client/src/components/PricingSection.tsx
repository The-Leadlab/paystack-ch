/*
 * Palette F — "Jet d'Eau" Light Theme
 * Four-tier pricing (Starter, Business, Unlimited, Enterprise).
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { useMemo } from "react";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { PLAN_ENTERPRISE_SALES_MAILTO } from "@/cafe/components/PlanMarketingPanel";

export default function PricingSection() {
  const { t, language } = useLanguage();
  const trialHref = (plan: string) => `/start-trial?plan=${plan}`;
  const plans = useMemo(() => [
    {
      name: t("planStarterName"),
      price: t("pricingStarterAmount"),
      period: t("pricingPerMonth"),
      description: t("planStarterDescription"),
      features: [
        t("planStarterFeature1"),
        t("planStarterFeature2"),
        t("planStarterFeature3"),
        t("planStarterFeature4"),
        t("planStarterFeature5"),
        t("planStarterFeature6"),
      ],
      cta: t("ctaStartTrial"),
      highlighted: false,
      href: trialHref("starter"),
    },
    {
      name: t("planBusinessName"),
      price: t("pricingBusinessAmount"),
      period: t("pricingPerMonth"),
      description: t("planBusinessDescription"),
      features: [
        t("planBusinessFeature1"),
        t("planBusinessFeature2"),
        t("planBusinessFeature3"),
        t("planBusinessFeature4"),
        t("planBusinessFeature5"),
        t("planBusinessFeature6"),
        t("planBusinessFeature7"),
      ],
      cta: t("ctaStartTrial"),
      highlighted: true,
      href: trialHref("business"),
    },
    {
      name: t("planUnlimitedName"),
      price: t("pricingUnlimitedAmount"),
      period: t("pricingPerMonth"),
      description: t("planUnlimitedDescription"),
      features: [
        t("planUnlimitedFeature1"),
        t("planUnlimitedFeature2"),
        t("planUnlimitedFeature3"),
        t("planUnlimitedFeature4"),
        t("planUnlimitedFeature5"),
        t("planUnlimitedFeature6"),
      ],
      cta: t("ctaStartTrial"),
      highlighted: false,
      href: trialHref("unlimited"),
    },
    {
      name: t("planEnterpriseName"),
      price: t("pricingCustom"),
      period: "",
      description: t("planEnterpriseDescription"),
      features: [
        t("planEnterpriseFeature1"),
        t("planEnterpriseFeature2"),
        t("planEnterpriseFeature3"),
        t("planEnterpriseFeature4"),
        t("planEnterpriseFeature5"),
        t("planEnterpriseFeature6"),
        t("planEnterpriseFeature7"),
        t("planEnterpriseFeature8"),
      ],
      cta: t("ctaContactSales"),
      highlighted: false,
      href: PLAN_ENTERPRISE_SALES_MAILTO,
      external: true,
    },
  ], [t, language]);

  return (
    <section id="pricing" className="relative py-24 lg:py-32 border-t border-border">
      <div className="container">
        <SectionLabel number="06" label={t("pricingTitle")} />

        <ScrollReveal>
          <div className="max-w-2xl mb-16">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("pricingHeadingStart")}{" "}
              <span className="font-editorial italic font-normal text-gradient-red">{t("pricingHeadingHighlight")}</span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed">
              {t("pricingDescription")}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
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
                    {t("pricingMostPopular")}
                  </div>
                )}

                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="font-editorial text-sm text-muted-foreground mb-6">
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  {plan.price !== t("pricingCustom") && (
                    <span className="font-data text-xs text-muted-foreground">{t("pricingCurrency")}</span>
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
                  asChild
                  className={`w-full font-display text-sm rounded-lg h-11 gap-2 group ${
                    plan.highlighted
                      ? "bg-brand-red text-white hover:bg-brand-red/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {"external" in plan && plan.external ? (
                    <a
                      href={plan.href}
                      className="inline-flex items-center justify-center gap-2 w-full"
                    >
                      {plan.cta}
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  ) : (
                    <Link href={plan.href} className="inline-flex items-center justify-center gap-2">
                      {plan.cta}
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </Button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
