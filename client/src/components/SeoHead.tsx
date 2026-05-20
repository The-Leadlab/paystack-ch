import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/cafe/context/LanguageContext";

function siteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL;
  const base =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "https://www.paystack.ch";
  return base.replace(/\/$/, "");
}

function normalizePath(path: string): string {
  if (!path || path === "") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

type SeoSlice = { title: string; description: string };

const SEO_EN: Record<string, SeoSlice> = {
  "/": {
    title: "Paystack.ch — Swiss Financial Management Platform",
    description:
      "AI-powered financial management for Swiss businesses. Manage incomes, expenses, salaries, and reporting via document upload. Built for Switzerland.",
  },
  "/app": {
    title: "Dashboard — Paystack.ch",
    description:
      "Financial workspace for income, expenses, payroll, VAT, and documents. Sign in to manage your Swiss business on Paystack.ch.",
  },
  "/sign-in": {
    title: "Sign in — Paystack.ch",
    description: "Sign in to your Paystack.ch account for Swiss financial management and document automation.",
  },
  "/sign-up": {
    title: "Create account — Paystack.ch",
    description: "Create a Paystack.ch account to manage Swiss finances, salaries, and reporting in one place.",
  },
  "/login": {
    title: "Sign in — Paystack.ch",
    description: "Sign in to your Paystack.ch account for Swiss financial management and document automation.",
  },
  "/signup": {
    title: "Create account — Paystack.ch",
    description: "Create a Paystack.ch account to manage Swiss finances, salaries, and reporting in one place.",
  },
  "/start-trial": {
    title: "Start trial — Paystack.ch",
    description: "Start your Paystack.ch trial for AI-assisted Swiss financial management.",
  },
  "/admin": {
    title: "Admin — Paystack.ch",
    description: "Paystack.ch administrator sign-in.",
  },
  "/operator": {
    title: "Operator — Paystack.ch",
    description: "Paystack.ch operator access.",
  },
  "/404": {
    title: "Page not found — Paystack.ch",
    description: "The page you requested could not be found on Paystack.ch.",
  },
};

const SEO_FR: Record<string, SeoSlice> = {
  "/": {
    title: "Paystack.ch — Plateforme financière suisse",
    description:
      "Gestion financière assistée par IA pour les entreprises suisses : revenus, dépenses, salaires et reporting via documents. Conçu pour la Suisse.",
  },
  "/app": {
    title: "Tableau de bord — Paystack.ch",
    description:
      "Espace financier : revenus, dépenses, paie, TVA et documents. Connectez-vous pour gérer votre entreprise suisse sur Paystack.ch.",
  },
  "/sign-in": {
    title: "Connexion — Paystack.ch",
    description: "Connectez-vous à votre compte Paystack.ch pour la gestion financière et l'automatisation documentaire.",
  },
  "/sign-up": {
    title: "Créer un compte — Paystack.ch",
    description: "Créez un compte Paystack.ch pour centraliser finances, salaires et reporting.",
  },
  "/login": {
    title: "Connexion — Paystack.ch",
    description: "Connectez-vous à votre compte Paystack.ch pour la gestion financière et l'automatisation documentaire.",
  },
  "/signup": {
    title: "Créer un compte — Paystack.ch",
    description: "Créez un compte Paystack.ch pour centraliser finances, salaires et reporting.",
  },
  "/start-trial": {
    title: "Essai — Paystack.ch",
    description: "Démarrez votre essai Paystack.ch pour la gestion financière suisse assistée par IA.",
  },
  "/admin": {
    title: "Administration — Paystack.ch",
    description: "Connexion administrateur Paystack.ch.",
  },
  "/operator": {
    title: "Opérateur — Paystack.ch",
    description: "Accès opérateur Paystack.ch.",
  },
  "/404": {
    title: "Page introuvable — Paystack.ch",
    description: "La page demandée est introuvable sur Paystack.ch.",
  },
};

function pickSeo(path: string, lang: "en" | "fr"): SeoSlice {
  const table = lang === "fr" ? SEO_FR : SEO_EN;
  if (table[path]) return table[path];
  if (path.startsWith("/app")) return table["/app"];
  return table["/"];
}

/**
 * Updates document title, canonical, description, and Open Graph tags per route + language.
 */
export function SeoHead() {
  const [path] = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    const normalized = normalizePath(path);
    const origin = siteOrigin();
    const canonical = `${origin}${normalized === "/" ? "/" : normalized}`;
    const seo = pickSeo(normalized, language);

    document.title = seo.title;

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonical);

    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", seo.description);

    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", seo.title);

    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute("content", seo.description);

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", canonical);
  }, [path, language]);

  return null;
}
