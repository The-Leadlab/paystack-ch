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
    
    // Sidebar
    employees: 'Employees',
    addEmployee: 'Employee',
    noEmployees: 'No employees',
    salary: 'Salary',
    contributions: 'Contributions',
    logout: 'Logout',
    
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
  },
  fr: {
    // Header
    appName: 'CAFE DE LA PLACE',
    financialDashboard: 'Tableau de bord financier',
    
    // Sidebar
    employees: 'Employés',
    addEmployee: 'Employé',
    noEmployees: 'Aucun employé',
    salary: 'Salaire',
    contributions: 'Cotisations',
    logout: 'Déconnexion',
    
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
