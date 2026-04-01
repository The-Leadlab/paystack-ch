
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, FinancialData, BankTransaction, BankStatementAnalysis } from "../types";

export const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getLiveExchangeRate = async (from: string, to: string): Promise<number> => {
  if (!from || from === to || from === '---') return 1.0;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    return data.rates[to] || 1.0;
  } catch (e) {
    return 1.0;
  }
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const analyzeFinancialDocument = async (
  file: File, 
  targetCurrency: string = 'CHF', 
  userHint?: string
): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  console.log(`📄 Analyzing: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
  console.log(`🔑 API Key configured: ${import.meta.env.VITE_GEMINI_API_KEY ? 'Yes' : 'No'}`);

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    console.log(`🤖 Calling Gemini API...`);
    const startTime = Date.now();
    
    const coreSchema: any = {
      type: Type.OBJECT,
      properties: {
        documentType: {
          type: Type.STRING,
          enum: ["Bank Statement", "Pay Slip", "Invoice", "Ticket/Receipt", "Z2 Multi-Ticket Sheet", "Bank Deposit", "Unknown"],
          description: "MANDATORY: Use 'Bank Deposit' for ATM/Bank confirmations. Use 'Z2 Multi-Ticket Sheet' ONLY if the file contains 2 or more distinct receipts/invoices."
        },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        issuer: { type: Type.STRING, description: "Primary entity name." },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER, description: "Total amount INCLUDING VAT" },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER, description: "VAT/Tax amount if shown. Extract from 'TVA', 'VAT', 'MwSt', 'Tax', 'IVA' labels. Set to 0 if not found." },
        vatRate: { type: Type.NUMBER, description: "VAT rate percentage if shown (e.g., 7.7, 8.1, 19, 20). Set to 0 if not found." },
        netAmount: { type: Type.NUMBER, description: "Amount BEFORE VAT (net/HT). Calculate as totalAmount - vatAmount if not explicitly shown." },
        expenseCategory: { 
          type: Type.STRING,
          description: "CRITICAL: Provide SPECIFIC category based on issuer and context. Examples: 'Restaurant / Dining' for restaurants, 'Groceries / Food' for supermarkets, 'Beauty / Personal Care' for salons/cosmetics, 'Travel / Transport' for tickets/fuel, 'Health / Medical' for pharmacies/doctors, 'Utilities / Bills' for electricity/water/phone, 'Software / IT' for tech services, 'Professional Services' for consultants/lawyers, 'Office Supplies' for stationery, 'Insurance' for insurance companies, 'Bank Fees / Finance' for bank charges, 'Entertainment' for cinema/events, 'Education / Training' for courses/schools. Be SPECIFIC, not generic."
        },
        amountInCHF: { type: Type.NUMBER },
        notes: { type: Type.STRING },
        aiInterpretation: { type: Type.STRING, description: "Diagnostic explanation of the scan result." },
        confidenceScore: { type: Type.NUMBER },
        forensicAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
        openingBalance: { type: Type.NUMBER },
        finalBalance: { type: Type.NUMBER, description: "The final balance (solde) shown on the bank document." },
        calculatedTotalIncome: { type: Type.NUMBER },
        calculatedTotalExpense: { type: Type.NUMBER },
        paySlip: {
          type: Type.OBJECT,
          description: "Optional. Populate ONLY when documentType is 'Pay Slip'. Extract employee/customer and employer/business data and a full breakdown of earnings and deductions.",
          properties: {
            employee: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                idNumber: { type: Type.STRING },
                address: { type: Type.STRING },
              },
              required: ["name"],
            },
            employer: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                idNumber: { type: Type.STRING },
                address: { type: Type.STRING },
              },
              required: ["name"],
            },
            payslipNumber: { type: Type.STRING },
            periodStart: { type: Type.STRING, description: "YYYY-MM-DD or best available format" },
            periodEnd: { type: Type.STRING, description: "YYYY-MM-DD or best available format" },
            payDate: { type: Type.STRING, description: "YYYY-MM-DD or best available format" },
            currency: { type: Type.STRING },
            grossPay: { type: Type.NUMBER, description: "Total earnings before deductions" },
            netPay: { type: Type.NUMBER, description: "Final amount received after deductions" },
            components: {
              type: Type.ARRAY,
              description: "Full list of earnings and deductions lines.",
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING, description: "Component label (e.g., salary, bonus, tax, insurance)" },
                  amount: { type: Type.NUMBER },
                  // Map earnings → INCOME and deductions → EXPENSE
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING, description: "Category label for audit (free text)" },
                },
                required: ["date", "description", "amount", "type", "category"],
              },
            },
          },
        },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING }
            }
          }
        },
        subDocuments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              issuer: { type: Type.STRING },
              date: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER, description: "Total including VAT" },
              originalCurrency: { type: Type.STRING },
              documentType: { type: Type.STRING, enum: ["VOUCHER", "TICKET/RECEIPT", "BANK_DEPOSIT"] },
              expenseCategory: { type: Type.STRING },
              vatAmount: { type: Type.NUMBER, description: "VAT amount if visible" },
              vatRate: { type: Type.NUMBER, description: "VAT rate % if visible" },
              netAmount: { type: Type.NUMBER, description: "Amount before VAT" },
            }
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "expenseCategory"]
    };

    const hintSection = userHint ? `USER OVERRIDE HINT: "${userHint}".` : "";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `AUDIT INTELLIGENCE MISSION (DEEP SCAN):
            ${hintSection}
            
            1. MULTI-PAGE SCAN: This file might have dozens of pages. Scan EVERY page.
            2. ASSET ISOLATION: Identify every separate transaction confirmation. If multiple exist, use 'Z2 Multi-Ticket Sheet' and list them in 'subDocuments'.
            3. BANK STATEMENTS (CRITICAL): If this is a bank statement, you MUST extract EVERY transaction from EVERY page into 'lineItems'. Do NOT truncate, summarize, or limit the list. Each transaction row on the statement must appear as one object in lineItems with date, description, amount, type (INCOME or EXPENSE), and category. Include opening balance, final balance (solde), calculatedTotalIncome, and calculatedTotalExpense.
            4. PAY SLIPS (CRITICAL): If this is a pay slip, extract:
               - employee/customer: name, idNumber (if shown), address (if shown)
               - employer/business: name, idNumber (if shown), address (if shown)
               - payslip identifiers: payslipNumber (if shown), periodStart, periodEnd, payDate (if shown)
               - full earnings/deductions breakdown: every line into 'paySlip.components' with date (use payDate or best available), description, amount, type (INCOME for earnings, EXPENSE for deductions), and category (free text)
               - grossPay and netPay from the slip
               Also set standard audit fields as follows:
               - documentType must be exactly 'Pay Slip'
               - issuer must be the employer/business name
               - expenseCategory should be 'Salary' when this is payroll to the employee (otherwise use best-fit category)
               - vatAmount should be 0
               - netAmount should equal totalAmount
               - totalAmount should be netPay (final amount received)
            5. SMART CATEGORIZATION (CRITICAL): 
               - Analyze the ISSUER name and document content carefully
               - Restaurants/Cafes → "Restaurant / Dining"
               - Supermarkets/Food stores → "Groceries / Food"
               - Salons/Spas/Cosmetics → "Beauty / Personal Care"
               - Airlines/Trains/Taxis/Fuel → "Travel / Transport"
               - Pharmacies/Doctors/Hospitals → "Health / Medical"
               - Telecom/Electricity/Water → "Utilities / Bills"
               - Tech companies/SaaS → "Software / IT"
               - Consultants/Lawyers/Accountants → "Professional Services"
               - Stationery/Office equipment → "Office Supplies"
               - Insurance companies → "Insurance"
               - Banks/Financial institutions → "Bank Fees / Finance"
               - Cinema/Events/Subscriptions → "Entertainment"
               - Schools/Courses/Training → "Education / Training"
               - DO NOT use generic "SALARY" unless it's actually a salary payment
               - BE SPECIFIC based on the actual business type
            6. VAT DETECTION (CRITICAL): 
               - Look for VAT/Tax labels: "TVA", "VAT", "MwSt", "Tax", "IVA", "Steuer", "Taxe"
               - Extract VAT amount (vatAmount) if shown
               - Extract VAT rate percentage (vatRate) if shown (e.g., 7.7%, 8.1%, 19%, 20%)
               - Calculate net amount (netAmount) = totalAmount - vatAmount
               - If VAT is not shown, set vatAmount=0, vatRate=0, netAmount=totalAmount
               - For invoices/receipts, VAT is usually shown separately
               - For Z2 Multi-Ticket sheets, extract VAT for EACH sub-document
            
            Return JSON only.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: coreSchema,
      }
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ Gemini API responded in ${elapsed}ms`);

    const parsed = JSON.parse(response.text) as FinancialData;
    console.log(`📊 Parsed data:`, parsed);

    if (parsed.subDocuments && parsed.subDocuments.length > 0) {
       const sum = parsed.subDocuments.reduce((s, doc) => s + (doc.totalAmount || 0), 0);
       if (!parsed.totalAmount || parsed.totalAmount === 0) {
          parsed.totalAmount = sum;
       }
    }

    if (parsed.totalAmount !== undefined && (!parsed.amountInCHF || parsed.amountInCHF === 0)) {
      const rate = await getLiveExchangeRate(parsed.originalCurrency || 'CHF', targetCurrency);
      parsed.amountInCHF = parsed.totalAmount * rate;
      parsed.conversionRateUsed = rate;
    }

    return parsed;
  });
};

// Fixed analyzeBankStatement to properly handle the GenAI response and return BankStatementAnalysis
export const analyzeBankStatement = async (file: File, targetCurrency: string = 'CHF'): Promise<BankStatementAnalysis> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Extract the full multi-page transaction ledger from this bank statement. You MUST find the opening balance and final balance (solde).`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING }
                },
                required: ["date", "description", "amount", "type"]
              }
            },
            calculatedTotalIncome: { type: Type.NUMBER },
            calculatedTotalExpense: { type: Type.NUMBER },
            openingBalance: { type: Type.NUMBER },
            finalBalance: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            period: { type: Type.STRING }
          },
          required: ["transactions", "calculatedTotalIncome", "calculatedTotalExpense", "currency"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine");
    return JSON.parse(text) as BankStatementAnalysis;
  });
};
