/*
 * Palette F — "Jet d'Eau" Light Theme
 * Home: Full landing page assembling all sections in editorial order.
 */

import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustedBySection from "@/components/TrustedBySection";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import ModulesSection from "@/components/ModulesSection";
import BusinessTypesSection from "@/components/BusinessTypesSection";
import PlatformTourSection from "@/components/PlatformTourSection";
import PricingSection from "@/components/PricingSection";
import SecuritySection from "@/components/SecuritySection";
import MobileSection from "@/components/MobileSection";
import RoadmapSection from "@/components/RoadmapSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    // Defer until sections paint (fonts/images can shift layout).
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-[100dvh] min-h-screen flex flex-col bg-background text-foreground touch-manipulation overscroll-y-contain">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <TrustedBySection />
        <FeaturesSection />
        <HowItWorksSection />
        <ModulesSection />
        <BusinessTypesSection />
        <PlatformTourSection />
        <PricingSection />
        <SecuritySection />
        <MobileSection />
        <RoadmapSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
