/*
 * Palette F — "Jet d'Eau" Light Theme
 * Hero: Dramatic split — animated headline left, dashboard mockup right.
 * Light background with subtle warm tones, Geneva Red + Gold accents.
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

export default function HeroSection() {
  const goToSystem = () => {
    window.location.href = "/app";
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Light background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-[oklch(0.97_0.01_85)]" />
      
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(0.5 0.01 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.5 0.01 60) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Soft radial accents */}
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-brand-red-light rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-brand-gold-light rounded-full blur-[100px]" />

      <div className="container relative z-10 pt-24 lg:pt-32 pb-16">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Content — 5 columns */}
          <div className="lg:col-span-5">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-red/20 bg-brand-red/5 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
              <span className="font-data text-xs text-brand-red">Built for Switzerland</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-6 text-foreground"
            >
              Your Finances,{" "}
              <span className="text-gradient-red">Automated</span>
              <br />
              <span className="font-editorial font-normal italic text-[0.85em] text-muted-foreground">
                with Swiss Precision
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-md"
            >
              Upload any document — invoice, receipt, payslip — and let AI extract, categorize, and organize your financial data. Income, expenses, salaries, and reports in one platform.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 mb-12"
            >
              <Button
                size="lg"
                onClick={goToSystem}
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-7 h-12 text-sm gap-2 group"
              >
                Start Free Trial
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goToSystem}
                className="font-display rounded-lg px-7 h-12 text-sm gap-2 border-border hover:border-brand-red/40 hover:text-brand-red bg-transparent"
              >
                <Play size={14} />
                Watch Demo
              </Button>
            </motion.div>

            {/* Stats Row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="flex items-center gap-8"
            >
              <div>
                <div className="text-2xl font-bold text-foreground">
                  <AnimatedCounter end={95} suffix="%" />
                </div>
                <p className="font-display text-xs text-muted-foreground mt-1">OCR Accuracy</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  <AnimatedCounter end={10} suffix="x" />
                </div>
                <p className="font-display text-xs text-muted-foreground mt-1">Faster Processing</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  <AnimatedCounter end={500} suffix="+" />
                </div>
                <p className="font-display text-xs text-muted-foreground mt-1">Businesses</p>
              </div>
            </motion.div>
          </div>

          {/* Right — Dashboard Mockup — 7 columns */}
          <motion.div
            initial={{ opacity: 0, x: 60, rotateY: -5 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:col-span-7 relative"
          >
            {/* Soft glow behind image */}
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-red-light via-brand-gold-light to-brand-red-light rounded-2xl blur-2xl" />
            
            <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/8">
              <img
                src="/manus-storage/Image28.04.2026at01.15_01_307b72f8.png"
                alt="Paystack.ch Financial Dashboard showing income, expenses, salary summaries and AI document processing"
                className="w-full h-auto"
                loading="eager"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div className="hidden h-[320px] w-full items-center justify-center bg-gradient-to-br from-secondary to-background text-muted-foreground">
                Dashboard preview unavailable
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="absolute -bottom-4 -left-4 lg:-left-8 bg-card border border-border rounded-xl px-4 py-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <span className="font-data text-sm text-brand-red font-bold">AI</span>
                </div>
                <div>
                  <p className="font-display text-xs font-medium text-foreground">Document Processed</p>
                  <p className="font-data text-xs text-brand-red">CHF 2'486.63 extracted</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
