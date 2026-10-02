/*
 * Palette F — "Jet d'Eau" Light Theme
 * Footer: Clean editorial footer with ruled lines, minimal links, Swiss trust signals.
 */

import { useMemo } from "react";
import ScrollReveal from "./ScrollReveal";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/cafe/context/LanguageContext";

export default function Footer() {
  const { t, language } = useLanguage();

  const footerColumns = useMemo(
    () => [
      {
        title: t("footerColProduct"),
        links: [
          { label: t("footerProduct1"), href: "/#features" },
          { label: t("footerProduct2"), href: "/#how-it-works" },
          { label: t("footerProduct3"), href: "/#pricing" },
          { label: t("footerProduct4"), href: "/#modules" },
          { label: t("footerProduct5"), href: "/#security" },
        ],
      },
      {
        title: t("footerColCompany"),
        links: [
          { label: t("footerCompany1"), href: "/#contact" },
          { label: t("footerCompany2"), href: "/legal" },
          { label: t("footerCompany3"), href: "mailto:lucas@paystack.ch" },
          { label: t("footerCompany4"), href: "/#pricing" },
        ],
      },
      {
        title: t("footerColResources"),
        links: [
          { label: t("footerResources1"), href: "/#how-it-works" },
          { label: t("footerResources2"), href: "/privacy" },
          { label: t("footerResources3"), href: "/data-processing" },
          { label: t("footerResources4"), href: "/sign-in?redirect=%2Fapp" },
        ],
      },
      {
        title: t("footerColLegal"),
        links: [
          { label: t("footerLegal1"), href: "/privacy" },
          { label: t("footerLegal2"), href: "/terms" },
          { label: t("footerLegal3"), href: "/data-processing" },
          { label: t("footerLegal4"), href: "/legal" },
          { label: t("footerLegal5"), href: "/dmca" },
        ],
      },
    ],
    [language, t]
  );

  return (
    <footer className="relative border-t border-border bg-card">
      <div className="container py-16 lg:py-24">
        <ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <div className="mb-5">
                <BrandLogo
                  href="/"
                  markClassName="h-10 w-auto object-contain shrink-0"
                  wordmarkClassName="font-display font-semibold text-lg tracking-tight text-foreground"
                />
              </div>
              <p className="font-editorial text-sm text-muted-foreground leading-relaxed max-w-xs">{t("footerTagline")}</p>
              <div className="flex items-center gap-2 mt-5">
                <div className="w-5 h-5 rounded bg-brand-red flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">+</span>
                </div>
                <span className="font-data text-xs text-muted-foreground">{t("footerSwissSoftware")}</span>
              </div>
            </div>

            {/* Link Columns */}
            {footerColumns.map((col) => (
              <div key={col.title}>
                <h4 className="font-display text-sm font-semibold text-foreground mb-4 tracking-wide">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <a
                        href={link.href}
                        className="font-display text-sm text-muted-foreground hover:text-brand-red transition-colors duration-300"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Bottom Bar */}
        <div className="ruled-line mt-12 mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-display text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {t("footerCopyright")}
          </p>
          <div className="flex items-center gap-6">
            <span className="font-data text-xs text-muted-foreground">{t("footerTrustGdpr")}</span>
            <span className="text-border">|</span>
            <span className="font-data text-xs text-muted-foreground">{t("footerTrustSwissDp")}</span>
            <span className="text-border">|</span>
            <span className="font-data text-xs text-muted-foreground">{t("footerTrustSoc2")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
