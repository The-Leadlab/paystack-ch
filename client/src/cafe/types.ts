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
  /** Plan comptable CH konto (e.g. 3200, 1020) */
  account_code?: string;
  document_id?: string; // Link to source document
  created_at: string;
}

export interface Expense {
  id: string;
  restaurant_id: string;
  session_id: string;
  date: string;
  category: 'BILLS' | 'SUPPLIERS' | 'PAYROLL' | 'PAYROLL_TAXES' | 'OTHER';
  amount: number;
  vat_amount?: number; // VAT paid on expenses
  description: string;
  /** Plan comptable CH konto (e.g. 4200, 1500) */
  account_code?: string;
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

/** Swiss permit hint for payroll settlement (B/G/F = tax at source, C/CH = paid gross). */
export type SwissPermitType = 'B' | 'C' | 'G' | 'F' | 'CH' | 'UNKNOWN';

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
  /** Actual bank payment to employee (Payment / Remittance line; after advance if any). */
  paymentToEmployee?: number;
  /** Permit type drives default settlement mode in the verification UI. */
  permitType?: SwissPermitType;
  // Components: earnings (INCOME) and deductions (EXPENSE)
  components?: BankTransaction[];
}

/** One Swiss TVA column (e.g. 0% / 2.6% / 8.1%) with HT base and TVA amount — receipt-style breakdown */
export interface SwissVatRateLine {
  ratePercent: number;
  baseExclusive: number;
  vatAmount: number;
}

/** Receipt footer: Total marchandise, Total TVA, Dépôt, Total CHF */
export interface SwissVatReceiptTotals {
  merchandiseSubtotal?: number;
  vatTotal?: number;
  deposit?: number;
  totalInclVat?: number;
}

/** Agentic Plan comptable CH classification (RAG + Gemini). */
export interface SwissAccountClassification {
  account_code: string;
  account_name: string;
  reasoning: string;
  confidence: number;
  requires_human_review: boolean;
  vat_account_code?: string;
  candidate_codes?: string[];
  splits?: Array<{
    account_code: string;
    amount?: number;
    description: string;
    confidence?: number;
  }>;
}

/** Preview mapping for accountant review (aligns with Swiss TVA statement export codes) */
export interface SwissVatFormPreview {
  code200?: number;
  code220?: number;
  code400?: number;
  code500?: number;
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
  /** Standard Swiss VAT rate % when a single rate applies (optional) */
  vatRate?: number;
  expenseCategory: string;
  amountInCHF: number;
  conversionRateUsed: number;
  notes: string;
  lineItems?: BankTransaction[];
  subDocuments?: FinancialData[]; 
  paySlip?: PaySlipAnalysis;
  /** source_tax = net + state deductions (B, G, F). gross_paid = single gross payment (C, CH). */
  payrollSettlementMode?: 'source_tax' | 'gross_paid';
  forensicAlerts?: string[];
  groundingUrls?: string[];
  aiInterpretation?: string;
  confidenceScore?: number;
  isHumanVerified?: boolean;
  /** Multi-rate Swiss TVA table (ticket caisse / facture) — editable in UI */
  swissVatBreakdown?: SwissVatRateLine[];
  swissVatReceiptTotals?: SwissVatReceiptTotals;
  swissVatFormPreview?: SwissVatFormPreview;
  /** AI-assigned Plan comptable CH konto with confidence (see swissAccountClassifierService). */
  swissAccountClassification?: SwissAccountClassification;
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
  fileUrl?: string; // Firebase Storage download URL
  storagePath?: string; // documents/{uid}/... for server-side AI fetch
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
