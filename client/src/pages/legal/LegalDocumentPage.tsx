import { Link, useLocation } from "wouter";
import { AuthLayout } from "../auth/AuthLayout";
import { useLanguage } from "@/cafe/context/LanguageContext";

type DocId = "privacy" | "terms" | "processing" | "notice" | "dmca" | "unsubscribe";

const DOCS: Record<DocId, { en: string; fr: string }> = {
  privacy: {
    en: "Privacy policy",
    fr: "Politique de confidentialité",
  },
  terms: { en: "Terms of use", fr: "Conditions d'utilisation" },
  processing: { en: "Data processing", fr: "Traitement des données" },
  notice: { en: "Legal notice", fr: "Mentions légales" },
  dmca: { en: "Copyright / DMCA", fr: "Droit d'auteur / DMCA" },
  unsubscribe: { en: "Unsubscribe", fr: "Désinscription" },
};

function Section({ title, children }: { title: string; children: string }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
      <p className="font-editorial text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{children}</p>
    </section>
  );
}

export default function LegalDocumentPage() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [location] = useLocation();
  const routes: Array<[DocId, string]> = [
    ["unsubscribe", "/unsubscribe"],
    ["processing", "/data-processing"],
    ["privacy", "/privacy"],
    ["terms", "/terms"],
    ["notice", "/legal"],
    ["dmca", "/dmca"],
  ];
  const id: DocId = routes.find(([, path]) => location === path || location.startsWith(`${path}/`))?.[0] ?? "privacy";
  const title = DOCS[id][fr ? "fr" : "en"];
  const copy = fr ? FR[id] : EN[id];

  return (
    <AuthLayout heading={title} showFooterSecure={false}>
      <article className="max-w-2xl mx-auto space-y-6 pb-10">
        <p className="font-editorial text-xs text-muted-foreground">
          {fr
            ? "Paystack.ch · Genève, Suisse · lucas@paystack.ch · Dernière mise à jour : 2 octobre 2026. Ce texte décrit le fonctionnement du produit. Faites-le relire par un avocat suisse avant de vous y fier comme avis juridique."
            : "Paystack.ch · Geneva, Switzerland · lucas@paystack.ch · Last updated 2 October 2026. This text describes how the product operates. Have a Swiss lawyer review it before treating it as legal advice."}
        </p>
        {copy.map((block) => (
          <Section key={block.title} title={block.title}>
            {block.body}
          </Section>
        ))}
        <nav className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-border">
          {routes.map(([docId, path]) => (
            <Link key={docId} href={path} className="font-display text-xs text-brand-red hover:underline">
              {DOCS[docId][fr ? "fr" : "en"]}
            </Link>
          ))}
        </nav>
      </article>
    </AuthLayout>
  );
}

const EN: Record<DocId, Array<{ title: string; body: string }>> = {
  privacy: [
    {
      title: "Who we are",
      body: "Paystack.ch is a Swiss financial workspace for businesses and personal bookkeeping. Contact: lucas@paystack.ch, Geneva, Switzerland. We do not publish a street address in this product yet; write to that mailbox for the registered office.",
    },
    {
      title: "What we collect",
      body: "Account data you give us (name, email, password handled by our auth provider), the financial documents you upload, the figures extracted from them, billing status from our payment provider, and basic technical logs needed to keep the service online. We ask your date of birth at signup only to confirm you are 18 or older. We do not store that date on your profile.",
    },
    {
      title: "Why",
      body: "To open your workspace, read invoices and payroll files you upload, produce reports you ask for, bill the plan you choose, and protect the service against abuse. We do not sell personal data.",
    },
    {
      title: "Where it lives",
      body: "The app is operated from Switzerland for Swiss customers. Some infrastructure providers (hosting, authentication, payments, email delivery) may process data in the EU or the US under their own terms. We choose providers that offer a data-processing contract.",
    },
    {
      title: "How long",
      body: "We keep account and document data while your subscription is active and for a limited period afterwards so you can export it and so we can meet accounting duties. You can ask us to delete the account.",
    },
    {
      title: "Your rights",
      body: "Under the Swiss Federal Act on Data Protection, and the GDPR where it applies, you can ask for access, correction, deletion, or a copy of your data, and you can object to marketing. Email lucas@paystack.ch. You can also complain to the Swiss FDPIC.",
    },
    {
      title: "Cookies and fonts",
      body: "The site serves its own font files from paystack.ch. We do not load fonts from Google. If a tag manager is configured, it loads only after the page is ready. We do not run session replay.",
    },
  ],
  terms: [
    {
      title: "The service",
      body: "Paystack.ch lets you upload financial documents, review extracted figures, and keep a workspace for income, expenses, payroll, and reports. You must be 18 or older to open an account.",
    },
    {
      title: "Your documents",
      body: "Files you upload stay yours. You give us permission to process them so the product can extract figures and build the reports you request. Do not upload documents you have no right to share.",
    },
    {
      title: "Plans and renewal",
      body: "Paid plans renew automatically at the price shown on the pricing page, monthly or yearly as you selected, until you cancel. Cancel in billing settings before the renewal date to avoid the next charge. Starting a trial or checkout means you accept this renewal.",
    },
    {
      title: "Acceptable use",
      body: "Do not use the service to break the law, probe other customers' data, or upload malware. We may suspend an account that puts other customers or the platform at risk.",
    },
    {
      title: "Liability",
      body: "Figures extracted from documents are drafts for you to review. You remain responsible for filings you send to tax authorities. To the extent Swiss law allows, our liability is limited to the fees you paid us in the three months before the claim. Geneva courts and Swiss law apply.",
    },
  ],
  processing: [
    {
      title: "Roles",
      body: "When a business uploads employee or supplier data, that business is the controller of those records and Paystack.ch processes them to provide the workspace. For your own login and billing data, Paystack.ch is the controller.",
    },
    {
      title: "Instructions",
      body: "We process customer documents to extract amounts, VAT, and counterparties, to store them in the workspace you choose, and to send reports you trigger. We do not use those documents to train a public model.",
    },
    {
      title: "Subprocessors",
      body: "Hosting, authentication, card payments, and email delivery are handled by specialist providers. A current list is available by emailing lucas@paystack.ch. We require them to protect the data and use it only on our instructions.",
    },
    {
      title: "Help",
      body: "A business customer can ask for a data-processing addendum at lucas@paystack.ch.",
    },
  ],
  notice: [
    {
      title: "Operator",
      body: "Paystack.ch\nGeneva, Switzerland\nEmail: lucas@paystack.ch\nWebsite: https://www.paystack.ch",
    },
    {
      title: "What this site is",
      body: "A software service for Swiss financial document workflows. It is not a bank, not a fiduciary, and not the Nigerian payments company also called Paystack.",
    },
    {
      title: "Registered office",
      body: "The street address and IDE/VAT number are not stored in this product. Ask lucas@paystack.ch and we will send the current commercial-register details.",
    },
  ],
  dmca: [
    {
      title: "Copyright contact",
      body: "Designated contact for copyright notices: lucas@paystack.ch, Paystack.ch, Geneva, Switzerland. Uploads in a Paystack workspace are private to that account. They are not a public media gallery.",
    },
    {
      title: "How to send a notice",
      body: "Email the contact with: your name and address, the work you own, the URL or a description of where it appears, a statement that you believe the use is not authorised, and a statement that the notice is accurate. We will review notices about content we actually host.",
    },
    {
      title: "US Copyright Office agent",
      body: "A US DMCA designated-agent filing is separate from this page. To register one, the operator goes to the DMCA Designated Agent Directory on copyright.gov, creates an account, enters the service name, a physical address, phone, and email, and pays the filing fee (currently 6 US dollars). Registration is what US law treats as the safe-harbor filing. This page does not file that registration for you. A Swiss lawyer can confirm whether you need it.",
    },
  ],
  unsubscribe: [
    {
      title: "Marketing mail",
      body: "To stop promotional email from Paystack.ch, send a message to lucas@paystack.ch with the subject Unsubscribe, from the address that received the mail. We will stop marketing messages to that address. Service messages about your account or invoices can still be sent.",
    },
    {
      title: "Postal address on those emails",
      body: "Marketing emails include Paystack.ch, Geneva, Switzerland, and this unsubscribe link.",
    },
  ],
};

const FR: Record<DocId, Array<{ title: string; body: string }>> = {
  privacy: [
    {
      title: "Qui nous sommes",
      body: "Paystack.ch est un espace financier suisse pour les entreprises et la comptabilité personnelle. Contact : lucas@paystack.ch, Genève, Suisse. L'adresse de rue n'est pas publiée dans le produit ; écrivez à cette boîte pour le siège.",
    },
    {
      title: "Ce que nous collectons",
      body: "Les données de compte que vous fournissez (nom, e-mail, mot de passe géré par notre prestataire d'authentification), les documents financiers que vous déposez, les montants extraits, l'état de facturation, et des journaux techniques pour faire tourner le service. La date de naissance demandée à l'inscription sert seulement à vérifier que vous avez 18 ans. Nous ne l'enregistrons pas sur le profil.",
    },
    {
      title: "Pourquoi",
      body: "Pour ouvrir votre espace, lire les factures et fiches de paie que vous déposez, produire les rapports demandés, facturer le plan choisi, et protéger le service. Nous ne vendons pas les données personnelles.",
    },
    {
      title: "Où",
      body: "Le service est exploité depuis la Suisse pour une clientèle suisse. Certains prestataires (hébergement, authentification, paiement, e-mail) peuvent traiter des données dans l'UE ou aux États-Unis. Nous choisissons des prestataires qui proposent un contrat de traitement.",
    },
    {
      title: "Durée",
      body: "Nous conservons le compte et les documents pendant l'abonnement, puis une période limitée pour l'export et les obligations comptables. Vous pouvez demander la suppression du compte.",
    },
    {
      title: "Vos droits",
      body: "Selon la LPD suisse, et le RGPD lorsqu'il s'applique, vous pouvez demander l'accès, la rectification, l'effacement ou une copie, et vous opposer au marketing. Écrivez à lucas@paystack.ch. Vous pouvez aussi saisir le PFPDT.",
    },
    {
      title: "Cookies et polices",
      body: "Le site sert ses propres fichiers de polices depuis paystack.ch. Nous ne chargeons pas les polices de Google. S'il y a un gestionnaire de balises, il se charge après la page. Nous n'utilisons pas de session replay.",
    },
  ],
  terms: [
    {
      title: "Le service",
      body: "Paystack.ch permet de déposer des documents financiers, de vérifier les montants extraits, et de tenir un espace pour les revenus, les charges, les salaires et les rapports. Il faut avoir 18 ans pour ouvrir un compte.",
    },
    {
      title: "Vos documents",
      body: "Les fichiers déposés restent les vôtres. Vous nous autorisez à les traiter pour extraire les montants et construire les rapports demandés. Ne déposez pas un document que vous n'avez pas le droit de partager.",
    },
    {
      title: "Plans et renouvellement",
      body: "Les plans payants se renouvellent automatiquement au prix affiché, chaque mois ou chaque année selon votre choix, jusqu'à résiliation. Résiliez dans la facturation avant la date de renouvellement pour éviter le prochain prélèvement. Lancer un essai ou un paiement vaut acceptation de ce renouvellement.",
    },
    {
      title: "Usage acceptable",
      body: "N'utilisez pas le service pour enfreindre la loi, accéder aux données d'un autre client, ou déposer un logiciel malveillant. Nous pouvons suspendre un compte qui met les autres clients ou la plateforme en danger.",
    },
    {
      title: "Responsabilité",
      body: "Les montants extraits sont des brouillons à vérifier. Vous restez responsable des déclarations envoyées aux autorités fiscales. Dans la mesure permise par le droit suisse, notre responsabilité est limitée aux frais payés pendant les trois mois précédant la réclamation. Les tribunaux de Genève et le droit suisse s'appliquent.",
    },
  ],
  processing: [
    {
      title: "Rôles",
      body: "Lorsqu'une entreprise dépose des données de salariés ou de fournisseurs, elle est responsable de traitement de ces dossiers et Paystack.ch les traite pour fournir l'espace. Pour vos données de connexion et de facturation, Paystack.ch est responsable.",
    },
    {
      title: "Instructions",
      body: "Nous traitons les documents pour en extraire les montants, la TVA et les contreparties, les ranger dans l'espace choisi, et envoyer les rapports que vous déclenchez. Nous n'utilisons pas ces documents pour entraîner un modèle public.",
    },
    {
      title: "Sous-traitants",
      body: "L'hébergement, l'authentification, le paiement par carte et l'envoi d'e-mails passent par des prestataires spécialisés. La liste actuelle s'obtient auprès de lucas@paystack.ch. Ils ne traitent les données que sur nos instructions.",
    },
    {
      title: "Suite",
      body: "Un client entreprise peut demander un avenant de traitement à lucas@paystack.ch.",
    },
  ],
  notice: [
    {
      title: "Exploitant",
      body: "Paystack.ch\nGenève, Suisse\nE-mail : lucas@paystack.ch\nSite : https://www.paystack.ch",
    },
    {
      title: "Nature du site",
      body: "Un logiciel de travail sur documents financiers suisses. Ce n'est pas une banque, ni une fiduciaire, ni la société de paiement nigériane qui porte aussi le nom Paystack.",
    },
    {
      title: "Siège",
      body: "L'adresse de rue et le numéro IDE/TVA ne sont pas stockés dans ce produit. Écrivez à lucas@paystack.ch pour les données actuelles du registre du commerce.",
    },
  ],
  dmca: [
    {
      title: "Contact droit d'auteur",
      body: "Contact pour les notifications de droit d'auteur : lucas@paystack.ch, Paystack.ch, Genève, Suisse. Les fichiers d'un espace Paystack restent privés à ce compte. Ce n'est pas une galerie publique.",
    },
    {
      title: "Envoyer une notification",
      body: "Écrivez au contact avec : votre nom et adresse, l'œuvre concernée, l'URL ou une description de l'endroit, une déclaration que l'usage n'est pas autorisé, et une déclaration que la notification est exacte. Nous examinons les notifications sur un contenu que nous hébergeons réellement.",
    },
    {
      title: "Agent DMCA aux États-Unis",
      body: "L'enregistrement d'un agent DMCA auprès du Copyright Office américain est distinct de cette page. L'exploitant ouvre le répertoire des agents DMCA sur copyright.gov, crée un compte, indique le nom du service, une adresse physique, un téléphone et un e-mail, puis paie les frais de dépôt (actuellement 6 dollars). C'est cet enregistrement que le droit américain traite comme le dépôt du safe harbor. Cette page ne fait pas le dépôt à votre place. Un avocat suisse peut confirmer s'il est nécessaire.",
    },
  ],
  unsubscribe: [
    {
      title: "E-mails promotionnels",
      body: "Pour arrêter les e-mails promotionnels de Paystack.ch, écrivez à lucas@paystack.ch avec l'objet Unsubscribe, depuis l'adresse qui a reçu le message. Nous cessons les messages marketing vers cette adresse. Les messages de service liés au compte ou aux factures peuvent continuer.",
    },
    {
      title: "Adresse postale",
      body: "Les e-mails marketing indiquent Paystack.ch, Genève, Suisse, et ce lien de désinscription.",
    },
  ],
};
