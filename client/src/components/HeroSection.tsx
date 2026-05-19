/*
 * Palette F — "Jet d'Eau" Light Theme
 * Hero: Dramatic split — animated headline left, dashboard mockup right.
 * Light background with subtle warm tones, Geneva Red + Gold accents.
 */

import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { withStripeTestQuery } from "@/cafe/lib/stripeCheckoutClient";
import { LandingScreenshot } from "./LandingScreenshot";

export default function HeroSection() {
  const { t } = useLanguage();

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
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-brand-red-light rounded-full blur-[100px]" />

      <div className="container relative z-10 pt-[max(6rem,calc(env(safe-area-inset-top)+4.5rem))] sm:pt-24 lg:pt-32 pb-12 sm:pb-16">
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
              <span className="font-data text-xs text-brand-red">{t("heroBadge")}</span>
            </motion.div>

            {/* Headline — no opacity:0 animation (blocks LCP until JS + framer-motion) */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-6 text-foreground">
              {t("heroTitleLine1")}{" "}
              <span className="text-gradient-red">{t("heroTitleHighlight")}</span>
              <br />
              <span className="font-editorial font-normal italic text-[0.85em] text-muted-foreground">
                {t("heroTitleLine2")}
              </span>
            </h1>

            <p className="font-editorial text-lg text-muted-foreground leading-relaxed mb-8 max-w-md">
              {t("heroDescription")}
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 mb-12"
            >
              <Button
                asChild
                size="lg"
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 rounded-lg px-7 h-12 text-sm gap-2 group"
              >
                <Link href={withStripeTestQuery("/start-trial")} className="inline-flex items-center gap-2">
                  {t("heroStartTrial")}
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="font-display rounded-lg px-7 h-12 text-sm gap-2 border-border hover:border-brand-red/40 hover:text-brand-red bg-transparent"
              >
                <a href="#platform" className="inline-flex items-center gap-2">
                  <Play size={14} />
                  {t("heroWatchDemo")}
                </a>
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
                <p className="font-display text-xs text-muted-foreground mt-1">{t("heroStatAccuracy")}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  <AnimatedCounter end={10} suffix="x" />
                </div>
                <p className="font-display text-xs text-muted-foreground mt-1">{t("heroStatSpeed")}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  <AnimatedCounter end={500} suffix="+" />
                </div>
                <p className="font-display text-xs text-muted-foreground mt-1">{t("heroStatBusinesses")}</p>
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
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-red-light via-brand-red-light/80 to-brand-red-light rounded-2xl blur-2xl" />
            
            <div className="relative rounded-xl overflow-hidden border border-border shadow-xl shadow-black/8">
              <LandingScreenshot
                screen="dashboard"
                alt={t("heroImageAlt")}
                className="w-full h-auto"
                loading="eager"
              />
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
                  <p className="font-display text-xs font-medium text-foreground">{t("heroDocumentProcessed")}</p>
                  <p className="font-data text-xs text-brand-red">{t("heroExtractedAmount")}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
