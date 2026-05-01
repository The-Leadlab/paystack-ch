/*
 * Palette F — "Jet d'Eau" Light Theme
 * Navbar: Minimal editorial top nav. Charcoal + Geneva Red accent on light background.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const navLinks = [
    { label: t("navFeatures"), href: "#features" },
    { label: t("navHowItWorks"), href: "#how-it-works" },
    { label: t("navModules"), href: "#modules" },
    { label: t("navPlatform"), href: "#platform" },
    { label: t("navPricing"), href: "#pricing" },
    { label: t("navSecurity"), href: "#security" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container flex items-center justify-between h-20 lg:h-24">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-16 h-16 rounded-xl bg-brand-charcoal flex items-center justify-center">
              <span className="font-display font-bold text-xl text-white">P</span>
            </div>
            <span className="font-display font-semibold text-2xl tracking-tight text-foreground">
              paystack<span className="text-brand-red">.ch</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 tracking-wide"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setLanguage(language === "en" ? "fr" : "en")}
              className="font-display text-xs text-muted-foreground hover:text-foreground transition-colors duration-300 border border-border rounded-md px-2.5 py-1.5"
              aria-label={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
            >
              {t("navChangeLanguage")}: {language === "en" ? "FR" : "EN"}
            </button>
            <a
              href="#contact"
              className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              {t("navContact")}
            </a>
            <Button
              size="sm"
              className="font-display text-sm bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-5"
            >
              {t("navGetStarted")}
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-foreground"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/98 backdrop-blur-xl pt-20 lg:hidden"
          >
            <div className="container flex flex-col gap-6 py-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-display text-2xl font-light text-foreground hover:text-brand-red transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="ruled-line my-4" />
              <a
                href="#contact"
                onClick={() => setMobileOpen(false)}
                className="font-display text-2xl font-light text-foreground hover:text-brand-red transition-colors"
              >
                {t("navContact")}
              </a>
              <button
                onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                className="text-left font-display text-2xl font-light text-foreground hover:text-brand-red transition-colors"
              >
                {language === "en" ? "FR" : "EN"}
              </button>
              <Button
                size="lg"
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg mt-4 w-full"
              >
                {t("navGetStarted")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
