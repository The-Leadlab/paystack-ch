export interface Client {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Employee {
  id: string;
  restaurant_id: string; // links to the restaurant owner
  name: string;
  position?: string;
  monthly_salary?: number;
  social_contributions?: number; // employer contributions
  created_at: string;
}

export interface Income {
  id: string;
  restaurant_id: string;
  date: string;
  type: 'SALES' | 'RESERVATION';
  amount: number;
  description?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  restaurant_id: string;
  date: string;
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER';
  amount: number;
  description: string;
  employee_id?: string; // if category is PAYROLL
  created_at: string;
}

export enum DocumentType {
  BANK_STATEMENT = 'Bank Statement',
  PAY_SLIP = 'Pay Slip',
  INVOICE = 'Invoice',
  RECEIPT = 'Ticket/Receipt',
  Z2_BULK_REPORT = 'Z2 Multi-Ticket Sheet',
  BANK_DEPOSIT = 'Bank Deposit',
  UNKNOWN = 'Unknown'
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string; 
  notes?: string;
  quantity?: number;
  unitPrice?: number;
  isHumanVerified?: boolean;
}

export interface PaySlipParty {
  name: string;
  idNumber?: string;
  address?: string;
}

export interface PaySlipAnalysis {
  employee: PaySlipParty;
  employer: PaySlipParty;
  payslipNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  payDate?: string;
  currency?: string;
  grossPay?: number;
  netPay?: number;
  // Components: earnings (INCOME) and deductions (EXPENSE)
  components?: BankTransaction[];
}

export interface FinancialData {
  documentType: DocumentType;
  date: string;
  issuer: string;
  documentNumber: string;
  totalAmount: number;
  originalCurrency: string;
  vatAmount: number;
  netAmount: number;
  expenseCategory: string;
  amountInCHF: number;
  conversionRateUsed: number;
  notes: string;
  lineItems?: BankTransaction[];
  subDocuments?: FinancialData[]; 
  paySlip?: PaySlipAnalysis;
  forensicAlerts?: string[];
  groundingUrls?: string[];
  aiInterpretation?: string;
  confidenceScore?: number;
  isHumanVerified?: boolean;
  // Bank specific fields for audit
  openingBalance?: number;
  finalBalance?: number;
  calculatedTotalIncome?: number;
  calculatedTotalExpense?: number;
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'verifying';
  data?: FinancialData;
  error?: string;
  fileRaw?: File;
}

export interface BankStatementAnalysis {
  transactions: BankTransaction[];
  calculatedTotalIncome: number;
  calculatedTotalExpense: number;
  openingBalance?: number;
  finalBalance?: number;
  currency: string;
  period?: string;
}

export interface ProcessedBankStatement {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: BankStatementAnalysis;
  error?: string;
  fileRaw?: File;
}
