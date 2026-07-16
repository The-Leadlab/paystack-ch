export type ReportExportLocale = 'en' | 'fr';

export type ReportExportLabels = {
  allSessions: string;
  period: string;
  periodTo: string;
  generated: string;
  financialReport: string;
  summary: string;
  totalIncome: string;
  totalExpenses: string;
  balance: string;
  monthlyBreakdown: string;
  month: string;
  incomeChf: string;
  expensesChf: string;
  balanceChf: string;
  topSuppliers: string;
  supplier: string;
  amountChf: string;
  pctOfSuppliers: string;
  incomeDetails: string;
  incomeDetailsN: string;
  expenseDetails: string;
  expenseDetailsN: string;
  date: string;
  type: string;
  category: string;
  description: string;
  accountCode: string;
  vendor: string;
  vatChf: string;
  totalIncomeRow: string;
  totalExpensesRow: string;
  vatSummary: string;
  vatReceived: string;
  fromCustomers: string;
  vatPaid: string;
  onExpenses: string;
  vatBalance: string;
  toPay: string;
  refund: string;
  expenseBreakdown: string;
  suppliers: string;
  bills: string;
  payroll: string;
  payrollTaxes: string;
  other: string;
  employeePayroll: string;
  employeeName: string;
  totalPaid: string;
  payments: string;
  totalPayroll: string;
  footerGenerated: string;
  allowPopups: string;
  swissVatReport: string;
  mode: string;
  modeMonthly: string;
  modeSemiannual: string;
  modeYearly: string;
  filteredPeriod: string;
  periodCol: string;
  turnoverClients: string;
  purchases: string;
  tvaCollected: string;
  tvaPaid: string;
  netTvaDue: string;
  salesMissingTva: string;
  purchasesMissingTva: string;
  total: string;
  formMappingTitle: string;
  formCode: string;
  formDescription: string;
  form200: string;
  form220: string;
  form400: string;
  form500: string;
  swissTvaStatement: string;
  session: string;
  warningMissingTva: string;
  warningMissingTvaDetail: string;
  semesterH1: string;
  semesterH2: string;
  csvFilenameReport: string;
  csvFilenameVat: string;
};

const en: ReportExportLabels = {
  allSessions: 'All sessions',
  period: 'Period',
  periodTo: 'to',
  generated: 'Generated',
  financialReport: 'Financial report',
  summary: 'Summary',
  totalIncome: 'Total income',
  totalExpenses: 'Total expenses',
  balance: 'Balance',
  monthlyBreakdown: 'Monthly breakdown',
  month: 'Month',
  incomeChf: 'Income (CHF)',
  expensesChf: 'Expenses (CHF)',
  balanceChf: 'Balance (CHF)',
  topSuppliers: 'Top suppliers',
  supplier: 'Supplier',
  amountChf: 'Amount (CHF)',
  pctOfSuppliers: '% of total suppliers',
  incomeDetails: 'Income details',
  incomeDetailsN: 'Income details ({n} entries)',
  expenseDetails: 'Expense details',
  expenseDetailsN: 'Expense details ({n} entries)',
  date: 'Date',
  type: 'Type',
  category: 'Category',
  description: 'Description',
  accountCode: 'Account (Plan comptable CH)',
  vendor: 'Vendor',
  vatChf: 'VAT (CHF)',
  totalIncomeRow: 'Total income',
  totalExpensesRow: 'Total expenses',
  vatSummary: 'VAT summary',
  vatReceived: 'VAT received',
  fromCustomers: 'From customers',
  vatPaid: 'VAT paid',
  onExpenses: 'On expenses',
  vatBalance: 'VAT balance',
  toPay: 'To pay',
  refund: 'Refund',
  expenseBreakdown: 'Expense breakdown by category',
  suppliers: 'Suppliers',
  bills: 'Bills',
  payroll: 'Payroll',
  payrollTaxes: 'Payroll taxes',
  other: 'Other',
  employeePayroll: 'Employee payroll breakdown',
  employeeName: 'Employee',
  totalPaid: 'Total paid (CHF)',
  payments: 'Payments',
  totalPayroll: 'Total payroll',
  footerGenerated: 'This report was generated automatically by Paystack.ch',
  allowPopups: 'Please allow pop-ups to download the PDF',
  swissVatReport: 'Swiss VAT report',
  mode: 'Mode',
  modeMonthly: 'Monthly',
  modeSemiannual: 'Semiannual',
  modeYearly: 'Yearly',
  filteredPeriod: 'Filtered period',
  periodCol: 'Period',
  turnoverClients: 'Turnover (clients)',
  purchases: 'Purchases',
  tvaCollected: 'VAT collected (clients)',
  tvaPaid: 'VAT paid (suppliers)',
  netTvaDue: 'Net VAT due',
  salesMissingTva: 'Sales missing VAT',
  purchasesMissingTva: 'Purchases missing VAT',
  total: 'Total',
  formMappingTitle: 'Swiss VAT return mapping (accountant review)',
  formCode: 'Form code',
  formDescription: 'Description',
  form200: 'Taxable turnover (domestic supplies)',
  form220: 'Output tax / VAT collected on clients',
  form400: 'Input tax / VAT paid on suppliers',
  form500: 'Net VAT payable (220 − 400)',
  swissTvaStatement: 'Swiss VAT statement',
  session: 'Session',
  warningMissingTva: 'Warning',
  warningMissingTvaDetail:
    'Missing VAT detected on {sales} sales entries and {purchases} purchase entries.',
  semesterH1: 'Jan–Jun',
  semesterH2: 'Jul–Dec',
  csvFilenameReport: 'Financial_Report',
  csvFilenameVat: 'Swiss_VAT',
};

const fr: ReportExportLabels = {
  allSessions: 'Toutes les sessions',
  period: 'Période',
  periodTo: 'au',
  generated: 'Généré le',
  financialReport: 'Rapport financier',
  summary: 'Résumé',
  totalIncome: 'Total revenus',
  totalExpenses: 'Total dépenses',
  balance: 'Solde',
  monthlyBreakdown: 'Ventilation mensuelle',
  month: 'Mois',
  incomeChf: 'Revenus (CHF)',
  expensesChf: 'Dépenses (CHF)',
  balanceChf: 'Solde (CHF)',
  topSuppliers: 'Principaux fournisseurs',
  supplier: 'Fournisseur',
  amountChf: 'Montant (CHF)',
  pctOfSuppliers: '% du total fournisseurs',
  incomeDetails: 'Détail des revenus',
  incomeDetailsN: 'Détail des revenus ({n} lignes)',
  expenseDetails: 'Détail des dépenses',
  expenseDetailsN: 'Détail des dépenses ({n} lignes)',
  date: 'Date',
  type: 'Type',
  category: 'Catégorie',
  description: 'Description',
  accountCode: 'Compte (Plan comptable CH)',
  vendor: 'Fournisseur',
  vatChf: 'TVA (CHF)',
  totalIncomeRow: 'Total revenus',
  totalExpensesRow: 'Total dépenses',
  vatSummary: 'Résumé TVA',
  vatReceived: 'TVA collectée',
  fromCustomers: 'Chez les clients',
  vatPaid: 'TVA payée',
  onExpenses: 'Sur les dépenses',
  vatBalance: 'Solde TVA',
  toPay: 'À payer',
  refund: 'Remboursement',
  expenseBreakdown: 'Dépenses par catégorie',
  suppliers: 'Fournisseurs',
  bills: 'Factures',
  payroll: 'Salaires',
  payrollTaxes: 'Charges sociales',
  other: 'Autre',
  employeePayroll: 'Ventilation paie par employé',
  employeeName: 'Employé',
  totalPaid: 'Total versé (CHF)',
  payments: 'Paiements',
  totalPayroll: 'Masse salariale totale',
  footerGenerated: 'Rapport généré automatiquement par Paystack.ch',
  allowPopups: 'Autorisez les fenêtres pop-up pour télécharger le PDF',
  swissVatReport: 'Rapport TVA suisse',
  mode: 'Mode',
  modeMonthly: 'Mensuel',
  modeSemiannual: 'Semestriel',
  modeYearly: 'Annuel',
  filteredPeriod: 'Période filtrée',
  periodCol: 'Période',
  turnoverClients: "Chiffre d'affaires (clients)",
  purchases: 'Achats',
  tvaCollected: 'TVA collectée (clients)',
  tvaPaid: 'TVA payée (fournisseurs)',
  netTvaDue: 'TVA nette due',
  salesMissingTva: 'Ventes sans TVA',
  purchasesMissingTva: 'Achats sans TVA',
  total: 'Total',
  formMappingTitle: 'Ventilation déclaration TVA (revue comptable)',
  formCode: 'Code formulaire',
  formDescription: 'Description',
  form200: "Chiffre d'affaires imposable",
  form220: 'Impôt sur le chiffre d’affaires / TVA collectée',
  form400: 'Impôt préalable / TVA payée',
  form500: 'TVA nette due (220 − 400)',
  swissTvaStatement: 'Déclaration TVA suisse',
  session: 'Session',
  warningMissingTva: 'Attention',
  warningMissingTvaDetail:
    'TVA manquante sur {sales} lignes de ventes et {purchases} lignes d’achats.',
  semesterH1: 'janv.–juin',
  semesterH2: 'juil.–déc.',
  csvFilenameReport: 'Rapport_Financier',
  csvFilenameVat: 'TVA_Suisse',
};

export function getReportExportLabels(locale: ReportExportLocale = 'en'): ReportExportLabels {
  return locale === 'fr' ? fr : en;
}

export function chfLocaleFor(locale: ReportExportLocale): string {
  return locale === 'fr' ? 'fr-CH' : 'en-CH';
}
