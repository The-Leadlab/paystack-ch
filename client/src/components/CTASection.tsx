/*
 * Palette F — "Jet d'Eau" Light Theme
 * CTA: Contact section with editorial layout. Geneva Red + Gold accents.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone, MapPin, CheckCircle } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function CTASection() {
  const { t } = useLanguage();

  return (
    <section id="contact" className="relative py-24 lg:py-32 border-t border-border bg-secondary/30">
      <div className="container">
        <SectionLabel number="10" label={t("ctaSectionLabel")} />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left — CTA Content */}
          <ScrollReveal className="lg:col-span-7">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              {t("ctaSectionHeadingStart")}{" "}
              <span className="font-editorial italic font-normal text-gradient-red">
                {t("ctaSectionHeadingHighlight")}
              </span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              {t("ctaSectionDescription")}
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Button
                asChild
                size="lg"
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-8 h-12 text-sm gap-2 group"
              >
                <Link href="/sign-up" className="inline-flex items-center gap-2">
                  {t("ctaStartTrial")}
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-display rounded-lg px-8 h-12 text-sm border-border hover:border-brand-red/30 hover:text-brand-red bg-transparent"
              >
                {t("ctaSectionBookDemo")}
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                {t("ctaSectionTrust1")}
              </span>
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                {t("ctaSectionTrust2")}
              </span>
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                {t("ctaSectionTrust3")}
              </span>
            </div>
          </ScrollReveal>

          {/* Right — Contact Info */}
          <ScrollReveal className="lg:col-span-5" delay={0.2}>
            <div className="p-8 rounded-xl border border-border bg-card">
              <h3 className="font-display text-lg font-semibold text-foreground mb-6">
                {t("ctaSectionContactUs")}
              </h3>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-brand-red" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-foreground">{t("contactEmail")}</p>
                    <a href="mailto:info@paystack.ch" className="font-editorial text-sm text-muted-foreground hover:text-brand-red transition-colors">
                      info@paystack.ch
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-brand-red" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-foreground">{t("contactPhone")}</p>
                    <a href="tel:+41767220995" className="font-editorial text-sm text-muted-foreground hover:text-brand-red transition-colors">
                      +41 76 722 09 95
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-brand-red" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-foreground">{t("contactLocation")}</p>
                    <p className="font-editorial text-sm text-muted-foreground">
                      {t("contactCityCountry")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="ruled-line my-6" />

              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-brand-red flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">+</span>
                </div>
                <span className="font-data text-xs text-muted-foreground">
                  {t("swissMadeGeneva")}
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
