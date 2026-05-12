import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'fr';

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const translations = {
  en: {
    // Header
    appName: 'CAFE DE LA PLACE',
    financialDashboard: 'Financial Dashboard',
    
    // Tabs
    dashboard: 'Dashboard',
    revenue: 'Revenue',
    reports: 'Reports',
    documents: 'Documents',
    
    // Sidebar
    employees: 'Employees',
    addEmployee: 'Employee',
    noEmployees: 'No employees',
    salary: 'Salary',
    contributions: 'Contributions',
    logout: 'Logout',
    newSession: 'New Session',
    sessions: 'Sessions',
    allSessions: 'All Sessions',
    clearAll: 'Clear All',
    resetAllData: 'Reset All Data',
    resetView: 'Reset View',
    
    // Financial Summary
    income: 'Income',
    expenses: 'Expenses',
    payroll: 'Payroll',
    balance: 'Balance',
    
    // Income
    incomeTitle: 'Income',
    addIncome: 'Add',
    noIncome: 'No income recorded',
    sales: 'Sales',
    reservation: 'Reservations',
    
    // Expenses
    expensesTitle: 'Expenses',
    addExpense: 'Add',
    noExpenses: 'No expenses recorded',
    bills: 'Bills (electricity, rent...)',
    suppliers: 'Suppliers',
    payrollCategory: 'Payroll',
    other: 'Other',
    
    // Modals
    addEmployeeTitle: 'Add Employee',
    addIncomeTitle: 'Add Income',
    addExpenseTitle: 'Add Expense',
    name: 'Name',
    position: 'Position',
    monthlySalary: 'Monthly Salary (CHF)',
    socialContributions: 'Social Contributions (CHF)',
    date: 'Date',
    type: 'Type',
    amount: 'Amount (CHF)',
    description: 'Description',
    category: 'Category',
    add: 'Add',
    cancel: 'Cancel',
    
    // Types
    SALES: 'Sales',
    RESERVATION: 'Reservations',
    BILLS: 'Bills',
    SUPPLIERS: 'Suppliers',
    PAYROLL: 'Payroll',
    OTHER: 'Other',
    // Landing - Navbar
    navFeatures: 'Features',
    navHowItWorks: 'How It Works',
    navModules: 'Modules',
    navPlatform: 'Platform',
    navPricing: 'Pricing',
    navSecurity: 'Security',
    navContact: 'Contact',
    navGetStarted: 'Get Started',
    navSwitchToFrench: 'Switch to French',
    navSwitchToEnglish: 'Switch to English',
    navChangeLanguage: 'Change Language',
    /** Navbar: one-click toggle to the other language (landing defaults to FR) */
    navTranslateEnglish: 'English',
    navTranslateFrench: 'Français',

    // Landing - Hero
    heroBadge: 'Built for Switzerland',
    heroTitleLine1: 'Your Finances,',
    heroTitleHighlight: 'Automated',
    heroTitleLine2: 'with Swiss Precision',
    heroDescription:
      'Upload any document - invoice, receipt, payslip - and let AI extract, categorize, and organize your financial data. Income, expenses, salaries, and reports in one platform.',
    heroStartTrial: 'Start Free Trial',
    heroWatchDemo: 'Watch Demo',
    heroStatAccuracy: 'OCR Accuracy',
    heroStatSpeed: 'Faster Processing',
    heroStatBusinesses: 'Businesses',
    heroImageAlt:
      'Paystack.ch Financial Dashboard showing income, expenses, salary summaries and AI document processing',
    heroDocumentProcessed: 'Document Processed',
    heroExtractedAmount: "CHF 2'486.63 extracted",

    // Landing - Pricing
    pricingTitle: 'Pricing',
    pricingHeadingStart: 'Simple, transparent',
    pricingHeadingHighlight: 'pricing',
    pricingDescription:
      'All prices in CHF. Start with a 7-day trial (payment method on file), then recurring billing. Scale as your business grows.',
    pricingMostPopular: 'Most Popular',
    pricingCurrency: 'CHF',
    pricingCustom: 'Custom',
    pricingStarterAmount: '29.-',
    pricingBusinessAmount: '59.-',
    pricingUnlimitedAmount: '499.-',
    pricingPerMonth: '/month',
    planStarterName: 'Starter',
    planStarterDescription:
      'For freelancers and solo entrepreneurs getting started with financial automation.',
    planBusinessName: 'Business',
    planBusinessDescription:
      'For growing businesses that need full financial management with team access.',
    planUnlimitedName: 'Unlimited',
    planUnlimitedDescription:
      'For high-volume teams: every in-app module, no document cap, full Swiss reporting, and self-serve billing.',
    planEnterpriseName: 'Enterprise',
    planEnterpriseDescription:
      'For large organizations requiring custom integrations, SLA, and dedicated support.',
    planStarterFeature1: 'Document Processing (50/mo)',
    planStarterFeature2: 'Income & Expense Tracking',
    planStarterFeature3: 'Dashboard CHF totals; Reports tab with filters, monthly breakdown & CSV export',
    planStarterFeature4: '1 User',
    planStarterFeature5: 'Email Support',
    planStarterFeature6: 'Up to 2 saved sessions (your accounting periods)',
    planBusinessFeature1: 'Document Processing (500/mo)',
    planBusinessFeature2: 'Revenue tab: POS / Z-readings, payroll & up to 10 employees',
    planBusinessFeature3: 'PDF reports & Swiss TVA exports (CSV/PDF, by month or year)',
    planBusinessFeature4: 'Up to 10 Users',
    planBusinessFeature5: 'Unlimited sessions + “All sessions” consolidated totals',
    planBusinessFeature6: 'Priority Support',
    planBusinessFeature7: 'Stripe customer portal (plan, card, cancel)',
    planUnlimitedFeature1: 'Unlimited Document Processing',
    planUnlimitedFeature2: 'Unlimited Users',
    planUnlimitedFeature3: 'All Modules (Current + Future)',
    planUnlimitedFeature4: 'Full PDF & Swiss TVA reporting (same as Business, no doc cap)',
    planUnlimitedFeature5: 'Unlimited sessions, employees & “All sessions” view',
    planUnlimitedFeature6: 'Self-serve billing & upgrades via Stripe (no doc cap)',
    planEnterpriseFeature1: 'White Label Option',
    planEnterpriseFeature2: 'Unlimited Document Processing',
    planEnterpriseFeature3: 'Custom Integration',
    planEnterpriseFeature4: 'All Modules (Current + Future)',
    planEnterpriseFeature5: 'Unlimited Users',
    planEnterpriseFeature6: 'Dedicated Account Manager',
    planEnterpriseFeature7: 'SLA & Uptime Guarantee',
    planEnterpriseFeature8: 'On-premise Deployment',
    ctaStartTrial: 'Start Free Trial',
    ctaContactSales: 'Contact Sales',

    // Landing - CTA section
    ctaSectionLabel: 'Get Started',
    ctaSectionHeadingStart: 'Ready to automate',
    ctaSectionHeadingHighlight: 'your finances?',
    ctaSectionDescription:
      'Join Swiss businesses that have already transformed their financial management. Start with a 7-day trial, then continue with a simple subscription.',
    ctaSectionBookDemo: 'Book a Demo',
    ctaSectionTrust1: '7-day trial',
    ctaSectionTrust2: 'Secure billing via Stripe',
    ctaSectionTrust3: 'Cancel anytime',
    ctaSectionContactUs: 'Contact Us',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    contactLocation: 'Location',
    contactCityCountry: 'Geneva, Switzerland',
    swissMadeGeneva: 'Swiss Made Software - Geneva, CH',

    // Auth pages
    authTagline: 'Financial tracking',
    authSignInTitle: 'Sign in',
    authSignUpTitle: 'Create account',
    authDisplayName: 'Display name',
    authEmailLabel: 'Email',
    authPasswordLabel: 'Password',
    authContinueGoogle: 'Continue with Google',
    authSubmitSignIn: 'Sign in',
    authSubmitSignUp: 'Create account',
    authAdminTitle: 'Admin sign in',
    authAdminDescription: 'Admin access for existing Paystack.ch operators. No payment checkout required.',
    authAdminSubmit: 'Sign in as admin',
    authAdminGoogle: 'Continue as admin with Google',
    authAdminUnauthorized: 'This account is not configured as a Paystack.ch admin.',
    authNeedAccount: "Don't have an account?",
    authSignUpLink: 'Sign up',
    authHaveAccount: 'Already have an account?',
    authSignInLink: 'Sign in',
    authBackHome: 'Back to home',
    authFooterSecure: 'Secure access · Your data stays yours',
    authWorking: 'Please wait…',
    authFirebaseMissingShort: 'Firebase is not configured. Add VITE_FIREBASE_* to your environment.',
    checkoutSameEmailNote:
      'Payment method saved. Create your account using the same email you entered at checkout so your subscription links to this login.',
    navSignInExisting: 'Admin login',
    checkoutLinkErrorTitle: 'Could not link your subscription',
    checkoutTryAgain: 'Try again',
    checkoutContinueWithoutLink: 'Continue to app',

    // Pre-login Stripe checkout (/start-trial)
    startTrialTitle: 'Start your 7-day trial',
    startTrialSubtitle: 'Secure checkout',
    startTrialBody:
      'Add a payment method to start your trial. Billing begins after the trial unless you cancel in the customer portal. Then create or sign in with the same email.',
    startTrialBillingNote:
      'Use the same email for your Paystack.ch account as at Stripe checkout so your subscription attaches correctly.',
    startTrialCta: 'Continue to secure checkout',
    startTrialSignIn: 'Already have an account?',

    subscriptionLoading: 'Checking subscription…',
    subscriptionTitle: 'Subscribe to continue',
    subscriptionBody:
      'Your workspace requires an active plan. Start a 7-day trial (card required today), then you are billed automatically when the trial ends unless you cancel in the billing portal.',
    subscriptionCta: 'Start 7-day trial & subscribe',
    subscriptionUpdatePayment: 'Update payment method',
    subscriptionTrialUntil: 'Trial access until {date}',
    subscriptionManageBilling: 'Billing & plan',
    subscriptionPickPlan: 'Choose a plan',
    subscriptionEnterpriseHint: 'Enterprise (custom pricing): contact sales at info@paystack.ch.',
    subscriptionPickPlanError: 'Please choose Starter, Business, or Unlimited before continuing to checkout.',
    planLimitDocuments: 'Monthly document processing limit reached ({n} completed this month). Upgrade your plan to process more.',
    planLimitSessions: 'Your plan allows up to {n} accounting periods (sessions). Upgrade to add more.',
    planLimitEmployees: 'Your plan allows up to {n} employee slot(s). Upgrade to add more.',
    reportsAdvancedLocked: 'Advanced PDF exports and Swiss TVA statements require Business or higher.',
  },
  fr: {
    // Header
    appName: 'CAFE DE LA PLACE',
    financialDashboard: 'Tableau de bord financier',
    
    // Tabs
    dashboard: 'Tableau de bord',
    revenue: 'Revenus',
    reports: 'Rapports',
    documents: 'Documents',
    
    // Sidebar
    employees: 'Employés',
    addEmployee: 'Employé',
    noEmployees: 'Aucun employé',
    salary: 'Salaire',
    contributions: 'Cotisations',
    logout: 'Déconnexion',
    newSession: 'Nouvelle session',
    sessions: 'Sessions',
    allSessions: 'Toutes les sessions',
    clearAll: 'Tout effacer',
    resetAllData: 'Réinitialiser toutes les données',
    resetView: 'Réinitialiser la vue',
    
    // Financial Summary
    income: 'Revenus',
    expenses: 'Dépenses',
    payroll: 'Salaires',
    balance: 'Solde',
    
    // Income
    incomeTitle: 'Revenus',
    addIncome: 'Ajouter',
    noIncome: 'Aucun revenu enregistré',
    sales: 'Ventes',
    reservation: 'Réservations',
    
    // Expenses
    expensesTitle: 'Dépenses',
    addExpense: 'Ajouter',
    noExpenses: 'Aucune dépense enregistrée',
    bills: 'Factures (électricité, loyer...)',
    suppliers: 'Fournisseurs',
    payrollCategory: 'Salaires',
    other: 'Autre',
    
    // Modals
    addEmployeeTitle: 'Ajouter un employé',
    addIncomeTitle: 'Ajouter un revenu',
    addExpenseTitle: 'Ajouter une dépense',
    name: 'Nom',
    position: 'Poste',
    monthlySalary: 'Salaire mensuel (CHF)',
    socialContributions: 'Cotisations sociales (CHF)',
    date: 'Date',
    type: 'Type',
    amount: 'Montant (CHF)',
    description: 'Description',
    category: 'Catégorie',
    add: 'Ajouter',
    cancel: 'Annuler',
    
    // Types
    SALES: 'Ventes',
    RESERVATION: 'Réservations',
    BILLS: 'Factures',
    SUPPLIERS: 'Fournisseurs',
    PAYROLL: 'Salaires',
    OTHER: 'Autre',
    // Landing - Navbar
    navFeatures: 'Fonctionnalités',
    navHowItWorks: 'Comment ça marche',
    navModules: 'Modules',
    navPlatform: 'Plateforme',
    navPricing: 'Tarifs',
    navSecurity: 'Sécurité',
    navContact: 'Contact',
    navGetStarted: 'Commencer',
    navSwitchToFrench: 'Passer en français',
    navSwitchToEnglish: 'Passer en anglais',
    navChangeLanguage: 'Changer la langue',
    navTranslateEnglish: 'English',
    navTranslateFrench: 'Français',

    // Landing - Hero
    heroBadge: 'Concu pour la Suisse',
    heroTitleLine1: 'Vos finances,',
    heroTitleHighlight: 'automatisees',
    heroTitleLine2: 'avec la precision suisse',
    heroDescription:
      'Importez n\'importe quel document - facture, recu, fiche de paie - et laissez l\'IA extraire, categoriser et organiser vos donnees financieres. Revenus, depenses, salaires et rapports sur une seule plateforme.',
    heroStartTrial: 'Demarrer l\'essai gratuit',
    heroWatchDemo: 'Voir la demo',
    heroStatAccuracy: 'Precision OCR',
    heroStatSpeed: 'Traitement plus rapide',
    heroStatBusinesses: 'Entreprises',
    heroImageAlt:
      'Tableau de bord financier Paystack.ch affichant revenus, depenses, salaires et traitement IA des documents',
    heroDocumentProcessed: 'Document traite',
    heroExtractedAmount: "CHF 2'486.63 extrait",

    // Landing - Pricing
    pricingTitle: 'Tarifs',
    pricingHeadingStart: 'Tarification simple et',
    pricingHeadingHighlight: 'transparente',
    pricingDescription:
      'Tous les prix sont en CHF. Essai de 7 jours (carte enregistree), puis facturation recurrente. Evoluez au rythme de votre entreprise.',
    pricingMostPopular: 'Le plus populaire',
    pricingCurrency: 'CHF',
    pricingCustom: 'Sur mesure',
    pricingStarterAmount: '29.-',
    pricingBusinessAmount: '59.-',
    pricingUnlimitedAmount: '499.-',
    pricingPerMonth: '/mois',
    planStarterName: 'Starter',
    planStarterDescription:
      'Pour les freelances et entrepreneurs individuels qui debutent l\'automatisation financiere.',
    planBusinessName: 'Business',
    planBusinessDescription:
      'Pour les entreprises en croissance qui ont besoin d\'une gestion financiere complete avec acces equipe.',
    planUnlimitedName: 'Illimité',
    planUnlimitedDescription:
      'Pour les equipes a fort volume : tous les modules in-app, sans plafond de documents, rapports TVA complets et facturation autonome.',
    planEnterpriseName: 'Entreprise',
    planEnterpriseDescription:
      'Pour les grandes organisations necessitant des integrations personnalisees, un SLA et un support dedie.',
    planStarterFeature1: 'Traitement de documents (50/mois)',
    planStarterFeature2: 'Suivi revenus et depenses',
    planStarterFeature3: 'Totaux CHF sur le tableau de bord ; Rapports avec filtres, synthese mensuelle & export CSV',
    planStarterFeature4: '1 utilisateur',
    planStarterFeature5: 'Support email',
    planStarterFeature6: 'Jusqu\'a 2 sessions enregistrees (periodes comptables)',
    planBusinessFeature1: 'Traitement de documents (500/mois)',
    planBusinessFeature2: 'Onglet Revenus : POS / Z, paie & jusqu\'a 10 employes',
    planBusinessFeature3: 'Rapports PDF & TVA suisse (CSV/PDF, par mois ou annee)',
    planBusinessFeature4: 'Jusqu\'a 10 utilisateurs',
    planBusinessFeature5: 'Sessions illimitees + vue « Toutes les sessions »',
    planBusinessFeature6: 'Support prioritaire',
    planBusinessFeature7: 'Portail client Stripe (offre, carte, annulation)',
    planUnlimitedFeature1: 'Traitement de documents illimite',
    planUnlimitedFeature2: 'Utilisateurs illimites',
    planUnlimitedFeature3: 'Tous les modules (actuels + futurs)',
    planUnlimitedFeature4: 'Rapports PDF & TVA suisse complets (comme Business, sans plafond docs)',
    planUnlimitedFeature5: 'Sessions & employes illimites + vue « Toutes les sessions »',
    planUnlimitedFeature6: 'Facturation & changement d\'offre via Stripe (sans plafond docs)',
    planEnterpriseFeature1: 'Option marque blanche',
    planEnterpriseFeature2: 'Traitement de documents illimite',
    planEnterpriseFeature3: 'Integration personnalisee',
    planEnterpriseFeature4: 'Tous les modules (actuels + futurs)',
    planEnterpriseFeature5: 'Utilisateurs illimites',
    planEnterpriseFeature6: 'Responsable de compte dedie',
    planEnterpriseFeature7: 'SLA et garantie de disponibilite',
    planEnterpriseFeature8: 'Deploiement sur site (on-premise)',
    ctaStartTrial: 'Demarrer l\'essai gratuit',
    ctaContactSales: 'Contacter les ventes',

    // Landing - CTA section
    ctaSectionLabel: 'Commencer',
    ctaSectionHeadingStart: 'Pret a automatiser',
    ctaSectionHeadingHighlight: 'vos finances ?',
    ctaSectionDescription:
      'Rejoignez les entreprises suisses qui ont deja transforme leur gestion financiere. Essai 7 jours, puis abonnement simple.',
    ctaSectionBookDemo: 'Reserver une demo',
    ctaSectionTrust1: 'Essai 7 jours',
    ctaSectionTrust2: 'Paiement securise via Stripe',
    ctaSectionTrust3: 'Annulation a tout moment',
    ctaSectionContactUs: 'Contactez-nous',
    contactEmail: 'Email',
    contactPhone: 'Telephone',
    contactLocation: 'Adresse',
    contactCityCountry: 'Geneve, Suisse',
    swissMadeGeneva: 'Logiciel suisse - Geneve, CH',

    // Auth pages
    authTagline: 'Suivi financier',
    authSignInTitle: 'Connexion',
    authSignUpTitle: 'Creer un compte',
    authDisplayName: 'Nom affiche',
    authEmailLabel: 'E-mail',
    authPasswordLabel: 'Mot de passe',
    authContinueGoogle: 'Continuer avec Google',
    authSubmitSignIn: 'Se connecter',
    authSubmitSignUp: 'Creer mon compte',
    authAdminTitle: 'Connexion admin',
    authAdminDescription: 'Acces admin pour les operateurs Paystack.ch existants. Aucun paiement requis.',
    authAdminSubmit: 'Connexion admin',
    authAdminGoogle: 'Continuer en admin avec Google',
    authAdminUnauthorized: 'Ce compte n\'est pas configure comme admin Paystack.ch.',
    authNeedAccount: 'Pas encore de compte ?',
    authSignUpLink: 'S\'inscrire',
    authHaveAccount: 'Deja un compte ?',
    authSignInLink: 'Se connecter',
    authBackHome: 'Retour a l\'accueil',
    authFooterSecure: 'Acces securise — vos donnees vous appartiennent',
    authWorking: 'Patience…',
    authFirebaseMissingShort: 'Firebase n\'est pas configure. Ajoutez les variables VITE_FIREBASE_* a votre environnement.',
    checkoutSameEmailNote:
      'Paiement enregistre. Creez votre compte avec le meme e-mail qu\'a la caisse Stripe pour lier l\'abonnement a cette connexion.',
    navSignInExisting: 'Connexion admin',
    checkoutLinkErrorTitle: 'Impossible de lier l\'abonnement',
    checkoutTryAgain: 'Reessayer',
    checkoutContinueWithoutLink: 'Continuer vers l\'app',

    startTrialTitle: 'Demarrer l\'essai de 7 jours',
    startTrialSubtitle: 'Paiement securise',
    startTrialBody:
      'Ajoutez un moyen de paiement pour demarrer l\'essai. La facturation commence apres l\'essai sauf annulation dans le portail client. Puis creez un compte ou connectez-vous avec le meme e-mail.',
    startTrialBillingNote:
      'Utilisez le meme e-mail pour Paystack.ch qu\'a la caisse Stripe pour lier correctement l\'abonnement.',
    startTrialCta: 'Continuer vers le paiement securise',
    startTrialSignIn: 'Vous avez deja un compte ?',

    subscriptionLoading: 'Verification de l\'abonnement…',
    subscriptionTitle: 'Abonnez-vous pour continuer',
    subscriptionBody:
      'Cet espace necessite un abonnement actif. Demarrez un essai de 7 jours (carte requise), puis facturation automatique a la fin de l\'essai sauf annulation dans le portail Stripe.',
    subscriptionCta: 'Essai 7 jours et abonnement',
    subscriptionUpdatePayment: 'Mettre a jour le moyen de paiement',
    subscriptionTrialUntil: 'Essai jusqu\'au {date}',
    subscriptionManageBilling: 'Facturation et offre',
    subscriptionPickPlan: 'Choisissez une offre',
    subscriptionEnterpriseHint: 'Entreprise (tarif sur mesure) : contactez info@paystack.ch.',
    subscriptionPickPlanError: 'Choisissez Starter, Business ou Illimite avant le paiement.',
    planLimitDocuments: 'Plafond mensuel de traitement de documents atteint ({n} termines ce mois-ci). Passez a une offre superieure pour continuer.',
    planLimitSessions: 'Votre offre autorise au plus {n} periodes comptables (sessions). Passez a une offre superieure pour en ajouter.',
    planLimitEmployees: 'Votre offre autorise au plus {n} employe(s). Passez a une offre superieure pour en ajouter.',
    reportsAdvancedLocked: 'Les exports PDF avances et les declarations TVA suisses necessitent l\'offre Business ou superieure.',
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Swiss product: always open in French; language toggle applies for the current session only.
  const [language, setLanguageState] = useState<Language>('fr');

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
