
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

const isNonRetryableGeminiError = (error: any): boolean => {
  const message = String(error?.message || error || '');
  return (
    message.includes('API_KEY_INVALID') ||
    message.includes('API key not valid') ||
    message.includes('INVALID_ARGUMENT')
  );
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (isNonRetryableGeminiError(error)) {
      throw error;
    }
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
          description: "Document type classification"
        },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        issuer: { type: Type.STRING, description: "Primary entity name" },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER, description: "Total amount INCLUDING VAT" },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER, description: "VAT/Tax amount. Set to 0 if not found." },
        vatRate: { type: Type.NUMBER, description: "VAT rate %. Set to 0 if not found." },
        netAmount: { type: Type.NUMBER, description: "Amount BEFORE VAT" },
        expenseCategory: { 
          type: Type.STRING,
          description: "Specific category based on issuer"
        },
        amountInCHF: { type: Type.NUMBER },
        notes: { type: Type.STRING },
        aiInterpretation: { type: Type.STRING, description: "Brief scan result" },
        confidenceScore: { type: Type.NUMBER },
        forensicAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
        openingBalance: { type: Type.NUMBER },
        finalBalance: { type: Type.NUMBER },
        calculatedTotalIncome: { type: Type.NUMBER },
        calculatedTotalExpense: { type: Type.NUMBER },
        paySlip: {
          type: Type.OBJECT,
          description: "Populate ONLY for Pay Slips",
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
            periodStart: { type: Type.STRING },
            periodEnd: { type: Type.STRING },
            payDate: { type: Type.STRING },
            currency: { type: Type.STRING },
            grossPay: { type: Type.NUMBER },
            netPay: { type: Type.NUMBER },
            components: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
                  category: { type: Type.STRING },
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
              totalAmount: { type: Type.NUMBER },
              originalCurrency: { type: Type.STRING },
              documentType: { type: Type.STRING, enum: ["VOUCHER", "TICKET/RECEIPT", "BANK_DEPOSIT"] },
              expenseCategory: { type: Type.STRING },
              vatAmount: { type: Type.NUMBER },
              vatRate: { type: Type.NUMBER },
              netAmount: { type: Type.NUMBER },
            }
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "expenseCategory"]
    };

    const hintSection = userHint ? `USER HINT: "${userHint}".` : "";

    // Simplified, faster prompt
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Fast and current model
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Extract financial data from this document. ${hintSection}

CRITICAL RULES:
1. Identify document type accurately
2. Determine if this is INCOME (revenue, sales, deposits) or EXPENSE (bills, invoices to pay, purchases)
3. For INCOME documents: Set expenseCategory to "REVENUE" or "SALES"
4. For EXPENSE documents: Categorize specifically (e.g., "FOOD_SUPPLIES", "RENT", "UTILITIES")
5. Extract key financial data (amounts, dates, issuer)
6. For bank statements: extract ALL transactions into lineItems
7. For payslips: extract employee/employer info and components
8. Extract VAT if shown (TVA, VAT, MwSt, Tax labels)
9. For multi-document files: use subDocuments array

INCOME vs EXPENSE Detection:
- INCOME: Sales receipts, revenue reports, customer payments, deposits, Z-readings
- EXPENSE: Supplier invoices, bills to pay, purchases, rent, utilities, salaries

Return JSON only.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: coreSchema,
        temperature: 0.1, // Lower temperature for faster, more consistent results
        topP: 0.8,
        topK: 20,
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
