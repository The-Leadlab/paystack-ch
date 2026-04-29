/*
 * Palette F — "Jet d'Eau" Light Theme
 * Navbar: Minimal editorial top nav. Charcoal + Geneva Red accent on light background.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Modules", href: "#modules" },
  { label: "Platform", href: "#platform" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const goToSystem = () => {
    window.location.href = "/app";
  };

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
        <div className="container flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-brand-charcoal flex items-center justify-center">
              <span className="font-display font-bold text-sm text-white">P</span>
            </div>
            <span className="font-display font-semibold text-lg tracking-tight text-foreground">
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
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="/app"
              className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Sign In
            </a>
            <Button
              size="sm"
              onClick={goToSystem}
              className="font-display text-sm bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-5"
            >
              Get Started
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
                href="/app"
                onClick={() => setMobileOpen(false)}
                className="font-display text-2xl font-light text-foreground hover:text-brand-red transition-colors"
              >
                Sign In
              </a>
              <Button
                size="lg"
                onClick={goToSystem}
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg mt-4 w-full"
              >
                Get Started
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
