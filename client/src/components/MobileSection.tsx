/*
 * Palette F — "Jet d'Eau" Light Theme
 * Mobile: Showcase the upcoming mobile app with the phone mockup image.
 */

import { Button } from "@/components/ui/button";
import ScrollReveal from "./ScrollReveal";
import SectionLabel from "./SectionLabel";
import { Smartphone, Camera, Bell, Wifi } from "lucide-react";

const mobileFeatures = [
  { icon: Camera, label: "Photo et import", description: "Photographiez un document et traitez-le instantanement" },
  { icon: Bell, label: "Notifications push", description: "Alertes en temps reel pour documents et rapports" },
  { icon: Wifi, label: "Mode hors ligne", description: "Capture hors ligne, synchronisation a la connexion" },
  { icon: Smartphone, label: "Experience native", description: "Apps iOS et Android avec authentification biometrie" },
];

export default function MobileSection() {
  return (
    <section className="relative py-24 lg:py-32 border-t border-border overflow-hidden">
      <div className="container">
        <SectionLabel number="08" label="Application mobile" />

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left — Phone Mockup */}
          <ScrollReveal className="lg:col-span-5 flex justify-center" direction="left">
            <div className="relative">
              {/* Soft glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-brand-red-light via-brand-gold-light to-transparent rounded-full blur-3xl scale-150" />
              <img
                src="/manus-storage/mobile-app-mockup_869c6162.png"
                alt="Paystack.ch mobile app — financial dashboard on iPhone showing CHF balance and recent transactions"
                className="relative w-64 sm:w-72 lg:w-80 h-auto drop-shadow-xl"
                loading="lazy"
              />
            </div>
          </ScrollReveal>

          {/* Right — Content */}
          <div className="lg:col-span-7">
            <ScrollReveal>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 text-foreground">
                Vos finances,{" "}
                <span className="font-editorial italic font-normal text-gradient-gold">
                  dans votre poche
                </span>
              </h2>
              <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
                L'application mobile Paystack.ch apporte toute la puissance de gestion financiere sur smartphone. Scannez un recu, consultez votre tableau de bord et validez des depenses partout.
              </p>
            </ScrollReveal>

            <div className="grid sm:grid-cols-2 gap-4">
              {mobileFeatures.map((feature, index) => (
                <ScrollReveal key={feature.label} delay={index * 0.1}>
                  <div className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm hover:border-brand-red/15 transition-all duration-500">
                    <div className="w-10 h-10 rounded-lg bg-brand-red/8 flex items-center justify-center shrink-0 group-hover:bg-brand-red/12 transition-colors">
                      <feature.icon size={18} className="text-brand-red" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-medium text-foreground mb-1">
                        {feature.label}
                      </h4>
                      <p className="font-editorial text-xs text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.4}>
              <div className="mt-8 flex items-center gap-4">
                <Button
                  size="lg"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-6 h-11 text-sm"
                >
                  Rejoindre la liste d'attente
                </Button>
                <span className="font-data text-xs text-muted-foreground">
                  Disponible T3 2026
                </span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
