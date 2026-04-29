/*
 * Palette F — "Jet d'Eau" Light Theme
 * Footer: Clean editorial footer with ruled lines, minimal links, Swiss trust signals.
 */

import ScrollReveal from "./ScrollReveal";

const footerLinks = {
  Product: ["Features", "Pricing", "Modules", "Roadmap", "Changelog"],
  Company: ["About", "Careers", "Blog", "Press Kit"],
  Resources: ["Documentation", "API Reference", "Help Center", "Community"],
  Legal: ["Privacy Policy", "Terms of Service", "Data Processing", "Imprint"],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-border bg-card">
      <div className="container py-16 lg:py-24">
        <ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-12">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <a href="#" className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-brand-charcoal flex items-center justify-center">
                  <span className="font-display font-bold text-sm text-white">P</span>
                </div>
                <span className="font-display font-semibold text-lg tracking-tight text-foreground">
                  paystack<span className="text-brand-red">.ch</span>
                </span>
              </a>
              <p className="font-editorial text-sm text-muted-foreground leading-relaxed max-w-xs">
                AI-powered financial management built with Swiss precision. Trusted by businesses across Switzerland.
              </p>
              <div className="flex items-center gap-2 mt-5">
                <div className="w-5 h-5 rounded bg-brand-red flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">+</span>
                </div>
                <span className="font-data text-xs text-muted-foreground">Swiss Made Software</span>
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="font-display text-sm font-semibold text-foreground mb-4 tracking-wide">
                  {title}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
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
            &copy; {new Date().getFullYear()} Paystack.ch — All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="font-data text-xs text-muted-foreground">
              GDPR Compliant
            </span>
            <span className="text-border">|</span>
            <span className="font-data text-xs text-muted-foreground">
              Swiss Data Protection
            </span>
            <span className="text-border">|</span>
            <span className="font-data text-xs text-muted-foreground">
              SOC 2 Ready
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
