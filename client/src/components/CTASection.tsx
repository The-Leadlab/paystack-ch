/*
 * Palette F — "Jet d'Eau" Light Theme
 * CTA: Contact section with editorial layout. Geneva Red + Gold accents.
 */

import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Phone, MapPin, CheckCircle } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";

export default function CTASection() {
  const goToSystem = () => {
    window.location.href = "/app";
  };

  return (
    <section id="contact" className="relative py-24 lg:py-32 border-t border-border bg-secondary/30">
      <div className="container">
        <SectionLabel number="10" label="Get Started" />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left — CTA Content */}
          <ScrollReveal className="lg:col-span-7">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
              Ready to automate{" "}
              <span className="font-editorial italic font-normal text-gradient-red">
                your finances?
              </span>
            </h2>
            <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Join Swiss businesses that have already transformed their financial management. Start with a free trial — no credit card required.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Button
                size="lg"
                onClick={goToSystem}
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-8 h-12 text-sm gap-2 group"
              >
                Start Free Trial
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goToSystem}
                className="font-display rounded-lg px-8 h-12 text-sm border-border hover:border-brand-red/30 hover:text-brand-red bg-transparent"
              >
                Book a Demo
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                14-day free trial
              </span>
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                No credit card required
              </span>
              <span className="font-display flex items-center gap-2">
                <CheckCircle size={14} className="text-brand-red" />
                Cancel anytime
              </span>
            </div>
          </ScrollReveal>

          {/* Right — Contact Info */}
          <ScrollReveal className="lg:col-span-5" delay={0.2}>
            <div className="p-8 rounded-xl border border-border bg-card">
              <h3 className="font-display text-lg font-semibold text-foreground mb-6">
                Contact Us
              </h3>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-brand-red" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-foreground">Email</p>
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
                    <p className="font-display text-sm font-medium text-foreground">Phone</p>
                    <a href="tel:+41000000000" className="font-editorial text-sm text-muted-foreground hover:text-brand-red transition-colors">
                      +41 (0) 00 000 00 00
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-brand-red" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-foreground">Location</p>
                    <p className="font-editorial text-sm text-muted-foreground">
                      Geneva, Switzerland
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
                  Swiss Made Software — Geneva, CH
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
