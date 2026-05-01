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
      'All prices in CHF. Start with a 14-day free trial, no credit card required. Scale as your business grows.',
    pricingMostPopular: 'Most Popular',
    pricingCurrency: 'CHF',
    pricingCustom: 'Custom',
    planStarterName: 'Starter',
    planStarterDescription:
      'For freelancers and solo entrepreneurs getting started with financial automation.',
    planBusinessName: 'Business',
    planBusinessDescription:
      'For growing businesses that need full financial management with team access.',
    planEnterpriseName: 'Enterprise',
    planEnterpriseDescription:
      'For large organizations requiring custom integrations, SLA, and dedicated support.',
    planStarterFeature1: 'Document Processing (50/mo)',
    planStarterFeature2: 'Income & Expense Tracking',
    planStarterFeature3: 'Basic Reports & Export',
    planStarterFeature4: '1 User',
    planStarterFeature5: 'Email Support',
    planStarterFeature6: '2 Accounting Periods',
    planBusinessFeature1: 'Document Processing (500/mo)',
    planBusinessFeature2: 'All Core Modules',
    planBusinessFeature3: 'Payroll & Salary Management',
    planBusinessFeature4: 'Advanced Analytics & Reports',
    planBusinessFeature5: 'Up to 10 Users',
    planBusinessFeature6: 'Unlimited Periods',
    planBusinessFeature7: 'Priority Support',
    planBusinessFeature8: 'API Access',
    planEnterpriseFeature1: 'Unlimited Document Processing',
    planEnterpriseFeature2: 'All Modules (Current + Future)',
    planEnterpriseFeature3: 'Custom Integrations',
    planEnterpriseFeature4: 'White-label Option',
    planEnterpriseFeature5: 'Unlimited Users',
    planEnterpriseFeature6: 'Dedicated Account Manager',
    planEnterpriseFeature7: 'SLA & Uptime Guarantee',
    planEnterpriseFeature8: 'On-premise Deployment Option',
    ctaStartTrial: 'Start Free Trial',
    ctaContactSales: 'Contact Sales',

    // Landing - CTA section
    ctaSectionLabel: 'Get Started',
    ctaSectionHeadingStart: 'Ready to automate',
    ctaSectionHeadingHighlight: 'your finances?',
    ctaSectionDescription:
      'Join Swiss businesses that have already transformed their financial management. Start with a free trial - no credit card required.',
    ctaSectionBookDemo: 'Book a Demo',
    ctaSectionTrust1: '14-day free trial',
    ctaSectionTrust2: 'No credit card required',
    ctaSectionTrust3: 'Cancel anytime',
    ctaSectionContactUs: 'Contact Us',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    contactLocation: 'Location',
    contactCityCountry: 'Geneva, Switzerland',
    swissMadeGeneva: 'Swiss Made Software - Geneva, CH',
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
    navFeatures: 'Fonctionnalites',
    navHowItWorks: 'Comment ca marche',
    navModules: 'Modules',
    navPlatform: 'Plateforme',
    navPricing: 'Tarifs',
    navSecurity: 'Securite',
    navContact: 'Contact',
    navGetStarted: 'Commencer',
    navSwitchToFrench: 'Passer en francais',
    navSwitchToEnglish: 'Passer en anglais',

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
      'Tous les prix sont en CHF. Commencez avec un essai gratuit de 14 jours, sans carte de credit. Evoluez au rythme de votre entreprise.',
    pricingMostPopular: 'Le plus populaire',
    pricingCurrency: 'CHF',
    pricingCustom: 'Sur mesure',
    planStarterName: 'Starter',
    planStarterDescription:
      'Pour les freelances et entrepreneurs individuels qui debutent l\'automatisation financiere.',
    planBusinessName: 'Business',
    planBusinessDescription:
      'Pour les entreprises en croissance qui ont besoin d\'une gestion financiere complete avec acces equipe.',
    planEnterpriseName: 'Entreprise',
    planEnterpriseDescription:
      'Pour les grandes organisations necessitant des integrations personnalisees, un SLA et un support dedie.',
    planStarterFeature1: 'Traitement de documents (50/mois)',
    planStarterFeature2: 'Suivi revenus et depenses',
    planStarterFeature3: 'Rapports et export basiques',
    planStarterFeature4: '1 utilisateur',
    planStarterFeature5: 'Support email',
    planStarterFeature6: '2 periodes comptables',
    planBusinessFeature1: 'Traitement de documents (500/mois)',
    planBusinessFeature2: 'Tous les modules principaux',
    planBusinessFeature3: 'Gestion de la paie et des salaires',
    planBusinessFeature4: 'Analyses et rapports avances',
    planBusinessFeature5: 'Jusqu\'a 10 utilisateurs',
    planBusinessFeature6: 'Periodes illimitees',
    planBusinessFeature7: 'Support prioritaire',
    planBusinessFeature8: 'Acces API',
    planEnterpriseFeature1: 'Traitement de documents illimite',
    planEnterpriseFeature2: 'Tous les modules (actuels + futurs)',
    planEnterpriseFeature3: 'Integrations personnalisees',
    planEnterpriseFeature4: 'Option marque blanche',
    planEnterpriseFeature5: 'Utilisateurs illimites',
    planEnterpriseFeature6: 'Responsable de compte dedie',
    planEnterpriseFeature7: 'SLA et garantie de disponibilite',
    planEnterpriseFeature8: 'Option de deploiement on-premise',
    ctaStartTrial: 'Demarrer l\'essai gratuit',
    ctaContactSales: 'Contacter les ventes',

    // Landing - CTA section
    ctaSectionLabel: 'Commencer',
    ctaSectionHeadingStart: 'Pret a automatiser',
    ctaSectionHeadingHighlight: 'vos finances ?',
    ctaSectionDescription:
      'Rejoignez les entreprises suisses qui ont deja transforme leur gestion financiere. Commencez avec un essai gratuit - sans carte de credit.',
    ctaSectionBookDemo: 'Reserver une demo',
    ctaSectionTrust1: 'Essai gratuit 14 jours',
    ctaSectionTrust2: 'Sans carte de credit',
    ctaSectionTrust3: 'Annulation a tout moment',
    ctaSectionContactUs: 'Contactez-nous',
    contactEmail: 'Email',
    contactPhone: 'Telephone',
    contactLocation: 'Adresse',
    contactCityCountry: 'Geneve, Suisse',
    swissMadeGeneva: 'Logiciel suisse - Geneve, CH',
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'fr') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
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
