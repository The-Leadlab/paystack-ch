/*
 * Palette F — "Jet d'Eau" Light Theme
 * Navbar: Minimal editorial top nav. Charcoal + Geneva Red accent on light background.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 pt-[env(safe-area-inset-top)] ${
          scrolled
            ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container flex items-center justify-between h-16 sm:h-20 lg:h-24">
          {/* Logo */}
          <BrandLogo href="/" />

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "fr" : "en")}
              className="font-display text-xs border-border rounded-lg px-3"
              aria-label={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
              title={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
            >
              {language === "fr" ? t("navTranslateEnglish") : t("navTranslateFrench")}
            </Button>
            <a
              href="#contact"
              className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              {t("navContact")}
            </a>
            <Button
              asChild
              size="sm"
              className="font-display text-sm bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-5"
            >
              <a href="#pricing">{t("navGetStarted")}</a>
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
            className="fixed inset-0 z-40 bg-background/98 backdrop-blur-xl pt-[calc(5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] lg:hidden overflow-y-auto"
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
                type="button"
                onClick={() => {
                  setLanguage(language === "en" ? "fr" : "en");
                  setMobileOpen(false);
                }}
                className="text-left font-display text-2xl font-light text-foreground hover:text-brand-red transition-colors"
              >
                {language === "fr" ? t("navTranslateEnglish") : t("navTranslateFrench")}
              </button>
              <Button
                asChild
                size="lg"
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg mt-4 w-full"
              >
                <a href="#pricing" onClick={() => setMobileOpen(false)}>
                  {t("navGetStarted")}
                </a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
