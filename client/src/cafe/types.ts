export interface Session {
  id: string;
  restaurant_id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  is_pinned: boolean;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Employee {
  id: string;
  restaurant_id: string;
  session_id?: string; // optional - global if not set
  name: string;
  position?: string;
  monthly_salary?: number;
  net_salary?: number; // Net salary from payslip
  social_contributions?: number;
  state_rest?: number; // "Rest" amount from state invoice
  created_at: string;
}

export interface Income {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  type: 'SALES' | 'RESERVATION';
  amount: number;
  vat_amount?: number; // VAT received from customers
  description?: string;
  document_id?: string; // Link to source document
  created_at: string;
}

export interface Expense {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'OTHER';
  amount: number;
  vat_amount?: number; // VAT paid on expenses
  description: string;
  employee_id?: string;
  document_id?: string; // Link to source document
  created_at: string;
}

// POS/Z-Reading Types
export interface POSReading {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  
  // Sales breakdown
  gross_sales: number;
  net_sales: number;
  vat_amount: number;
  
  // Payment methods
  cash: number;
  card: number;
  other_payment: number;
  
  // Additional details
  tips: number;
  discounts: number;
  refunds: number;
  
  // Metadata
  notes?: string;
  image_url?: string; // If uploaded from photo
  created_at: string;
  updated_at: string;
}

export interface POSReading {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  // Revenue breakdown
  gross_revenue: number;
  vat_amount: number;
  net_revenue: number;
  tips: number;
  // Payment methods
  cash: number;
  card: number;
  other_payment: number;
  // Additional info
  notes?: string;
  photo_url?: string;
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
  status: 'pending' | 'processing' | 'completed' | 'error' | 'verifying' | 'skipped';
  data?: FinancialData;
  error?: string;
  fileRaw?: File;
  fileDataUrl?: string; // Deprecated - kept for backward compatibility
  fileUrl?: string; // Firebase Storage URL (NEW - free tier: 5GB storage)
  restaurantId?: string;
  session_id?: string;
  created_at?: string;
  fileHash?: string; // SHA-256 hash for duplicate detection
  persistedDocumentId?: string; // Firestore document id created at upload-time
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
