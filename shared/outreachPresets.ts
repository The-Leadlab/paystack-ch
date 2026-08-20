import { wrapBrandedLetterHtml, OUTREACH_DEMO_CALENDAR_URL, OUTREACH_UPLOAD_DEMO_GIF_URL } from "./outreachMail.js";
import { FONT_BODY, PLATFORM_CONTACT_EMAIL } from "./const.js";

export type OutreachPresetId = "blank-text" | "blank-html" | "beta-invite" | "beta-direct";

export type OutreachPreset = {
  id: OutreachPresetId;
  subject: string;
  mode: "html" | "text";
  body: string;
};

const P =
  `style="margin:0 0 16px;font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:#2B2B2B;"`;

function p(html: string): string {
  return `<p ${P}>${html}</p>`;
}

const inviteEn = [
  p("Hi {{name}},"),
  p(
    "Paystack started as a private system. Our founder works in private equity and built it to manage taxes and several businesses across Geneva — because accountants and financiers were taking too much time and too much money."
  ),
  p(
    "SMEs still lose hours (and thousands of francs a year) just processing the documents a business generates. Paystack is built to kill that problem: upload receipts and invoices, get a clear picture of revenue and expenses, and stop paying for work that software can do."
  ),
  p("For most SMEs, that is almost <strong>CHF 5–10,000 of expense a year</strong>."),
  p(
    "We are beta live right now, selectively looking for a small group of Geneva operators to beta-test with us. If you are open to a short, zero-cost conversation — and zero cost to accept our beta tester offer — please schedule a time with the button below, or reply to this email with any questions. Please see this as a free opportunity to save yourself time and money. No commitment."
  ),
  p(
    'The first <strong>100 beta testers</strong> who wish to become clients will get <strong>25% off for life</strong>.'
  ),
].join("\n");

const inviteFr = [
  p("Bonjour {{name}},"),
  p(
    "Paystack a commencé comme un outil privé. Notre fondateur travaille en private equity et l’a conçu pour gérer les impôts et plusieurs affaires à Genève — parce que comptables et financiers prenaient trop de temps et trop d’argent."
  ),
  p(
    "Les PME perdent encore des heures (et des milliers de francs par an) rien qu’à traiter les documents que l’activité génère. Paystack est là pour régler ce problème : déposer tickets et factures, voir clairement recettes et dépenses, et arrêter de payer un travail que le logiciel peut faire."
  ),
  p("Pour la plupart des PME, cela représente près de <strong>CHF 5–10’000 de frais par an</strong>."),
  p(
    "Nous sommes en bêta dès maintenant, et nous cherchons avec soin un petit groupe d’exploitants à Genève. Si vous êtes ouvert à un court échange sans frais — et sans frais pour accepter d’être testeur — planifiez un créneau avec le bouton ci-dessous, ou répondez à cet e-mail. Voyez cela comme une occasion gratuite de gagner du temps et de l’argent. Sans engagement."
  ),
  p("Les <strong>100 premiers testeurs</strong> qui souhaitent devenir clients auront <strong>−25 % à vie</strong>."),
].join("\n");

const directEn = [
  p("I hope this email finds you well. My name is {{sender}} from Paystack."),
  p("<strong>{{company}}</strong> has been chosen as an excellent candidate to be a Paystack beta tester."),
  p("Hi {{name}},"),
  p(
    "Paystack is a new system, built in Geneva so operators like you stop paying a fortune — and burning hours — for accountants to process the documents your business naturally produces."
  ),
  p(
    "For most operators, that is almost <strong>CHF 5–10,000 of expense a year</strong>. We are looking for beta testers before we go fully live."
  ),
  p(
    "You are on a short list: a leader in your field, based in Geneva. We are sending this to <strong>200 people</strong>. You are one of them."
  ),
  p(
    "If you are open to a conversation, use the button below to book a short meeting, or reply to this email. Free demo — no commitment."
  ),
  p("The first <strong>100 clients</strong> also get <strong>25% off for life</strong>."),
].join("\n");

const directFr = [
  p("J’espère que vous allez bien. Je m’appelle {{sender}}, de Paystack."),
  p("<strong>{{company}}</strong> a été choisi comme excellent candidat pour tester Paystack en bêta."),
  p("Bonjour {{name}},"),
  p(
    "Paystack est un nouveau système, conçu à Genève pour que des exploitants comme vous cessent de payer une fortune — et d’y passer des heures — pour qu’un comptable traite les documents que votre affaire produit naturellement."
  ),
  p(
    "Pour la plupart des exploitants, cela représente près de <strong>CHF 5–10’000 de frais par an</strong>. Nous cherchons des testeurs avant le lancement complet."
  ),
  p(
    "Vous êtes sur une liste courte : un acteur de référence dans votre métier, basé à Genève. Nous envoyons ce message à <strong>200 personnes</strong>. Vous en faites partie."
  ),
  p(
    "Si vous êtes ouvert à un échange, utilisez le bouton ci-dessous pour un court rendez-vous, ou répondez à cet e-mail. Démo gratuite — sans engagement."
  ),
  p("Les <strong>100 premiers clients</strong> ont aussi <strong>−25 % à vie</strong>."),
].join("\n");

const siteHint =
  'Or reply to this email · <a href="https://www.paystack.ch" style="color:#E8423F;text-decoration:none;">www.paystack.ch</a>';
const siteHintFr =
  'Ou répondez à cet e-mail · <a href="https://www.paystack.ch" style="color:#E8423F;text-decoration:none;">www.paystack.ch</a>';

export function getOutreachPreset(id: OutreachPresetId): OutreachPreset {
  if (id === "blank-text") {
    return {
      id,
      subject: "",
      mode: "text",
      body: "Hi {{name}},\n\n{{company}}\n\n{{extra}}\n",
    };
  }
  if (id === "blank-html") {
    return {
      id,
      subject: "",
      mode: "html",
      body: `<p>Hi {{name}},</p>
<p>{{company}}</p>
<p>{{extra}}</p>
`,
    };
  }
  if (id === "beta-invite") {
    return {
      id,
      subject: "You've been chosen / Vous avez été choisi",
      mode: "html",
      body: wrapBrandedLetterHtml({
        preheader:
          "Bêta privée pour les PME genevoises. Près de 5 à 10 000 CHF de frais par an. Échange sans frais. -25 % à vie.",
        title: "A private beta for Geneva SMEs",
        frenchTitle: "Une bêta privée pour les PME à Genève",
        frenchFirst: true,
        englishLabel: "English",
        innerHtml: inviteEn,
        frenchInnerHtml: inviteFr,
        ctaLabel: "Book a free demo",
        frenchCtaLabel: "Réserver une démo",
        ctaHref: OUTREACH_DEMO_CALENDAR_URL,
        ctaHint: siteHint,
        frenchCtaHint: siteHintFr,
        demoImageUrl: OUTREACH_UPLOAD_DEMO_GIF_URL,
        demoImageAlt: "Drag a PDF into the Paystack dashboard",
        signoffHtml: "Best regards,<br>\n                The Paystack.ch team",
      }),
    };
  }
  return {
    id: "beta-direct",
    subject: "You are one of 200 beta testers / Vous faites partie des 200 testeurs",
    mode: "html",
    body: wrapBrandedLetterHtml({
      preheader: "{{company}} has been chosen as a Paystack beta tester. Almost CHF 5–10,000 of expense a year.",
      title: "You are one of 200 beta testers",
      innerHtml: directEn,
      ctaLabel: "Book a meeting",
      ctaHref: `mailto:${PLATFORM_CONTACT_EMAIL}?subject=Paystack%20beta`,
      ctaHint: siteHint,
      frenchInnerHtml: directFr,
      frenchCtaLabel: "Prendre rendez-vous",
      frenchCtaHint: siteHintFr,
      signoffHtml: "Kind regards,<br>\n                {{sender}}<br>\n                Paystack.ch",
    }),
  };
}
