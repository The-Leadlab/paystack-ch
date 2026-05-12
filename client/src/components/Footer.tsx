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
      { title: t("footerColProduct"), links: [t("footerProduct1"), t("footerProduct2"), t("footerProduct3"), t("footerProduct4"), t("footerProduct5")] },
      { title: t("footerColCompany"), links: [t("footerCompany1"), t("footerCompany2"), t("footerCompany3"), t("footerCompany4")] },
      { title: t("footerColResources"), links: [t("footerResources1"), t("footerResources2"), t("footerResources3"), t("footerResources4")] },
      { title: t("footerColLegal"), links: [t("footerLegal1"), t("footerLegal2"), t("footerLegal3"), t("footerLegal4")] },
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
                    <li key={link}>
                      <a
                        href="#"
                        className="font-display text-sm text-muted-foreground hover:text-brand-red transition-colors duration-300"
                      >
                        {link}
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
