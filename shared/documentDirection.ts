/**
 * Document cash-flow direction (INCOME vs EXPENSE).
 *
 * Line items inherit the parent document’s direction. Product names (wine,
 * groceries, etc.) must never flip a purchase line to INCOME or a sales line
 * to EXPENSE. Bank statements stay MIXED so each row keeps its own type.
 */

export type DocumentFlow = "INCOME" | "EXPENSE" | "MIXED" | "SALARY";
export type LineFlowType = "INCOME" | "EXPENSE";
export type UserFlowOverride = "INCOME" | "EXPENSE" | "SALARY";
export type UploadIntent = "revenue" | "expense";

export type DocumentDirectionInput = {
  documentType?: string | null;
  expenseCategory?: string | null;
  issuer?: string | null;
  recipient?: string | null;
  notes?: string | null;
  aiInterpretation?: string | null;
  fileName?: string | null;
  ownBusinessNames?: string[] | null;
  userFlowOverride?: string | null;
  uploadIntent?: string | null;
  /** Gemini document-level INCOME/EXPENSE hint (seller vs buyer), never product name. */
  aiFlowHint?: string | null;
};

export type DirectedLineItem = {
  type?: string | null;
  [key: string]: unknown;
};

export type DirectedFinancialData = {
  documentType?: string | null;
  expenseCategory?: string | null;
  issuer?: string | null;
  recipient?: string | null;
  notes?: string | null;
  aiInterpretation?: string | null;
  userFlowOverride?: string | null;
  uploadIntent?: string | null;
  sourceFileName?: string | null;
  aiFlowHint?: string | null;
  lineItems?: DirectedLineItem[] | null;
  subDocuments?: DirectedFinancialData[] | null;
  [key: string]: unknown;
};

const INCOME_CATEGORY_MARKERS = ["REVENUE", "SALES", "RESERVATION", "INCOME"] as const;
const PAYROLL_CATEGORY_MARKERS = ["PAYROLL", "SALARY", "PAYSLIP"] as const;
const PURCHASE_CATEGORY_MARKERS = [
  "FOOD_SUPPLIES",
  "BEVERAGES",
  "SUPPLIERS",
  "RESTAURANT_SUPPLIES",
  "PACKAGING",
  "CLEANING",
  "MAINTENANCE",
  "RENT",
  "UTILITIES",
  "INSURANCE",
  "TELECOM",
  "BANK_FEES",
  "ACCOUNTING",
  "MARKETING",
  "DELIVERY",
  "OFFICE_SUPPLIES",
] as const;

const SALES_WORDING = [
  "facture de vente",
  "facture client",
  "facture clients",
  "sales invoice",
  "customer invoice",
  "invoice issued",
  "issued by us",
  "sold to",
  "bill to customer",
  "chiffre d'affaires",
  "chiffre daffaires",
  "z-reading",
  "z reading",
  "z-report",
  "ticket de caisse vente",
];

const SUPPLIER_WORDING = [
  "facture fournisseur",
  "facture fournisseurs",
  "fournisseur",
  "fournisseurs",
  "supplier invoice",
  "purchase invoice",
  "invoice to us",
  "billed to us",
  "bill to us",
  "achat",
  "achats",
  "purchase order",
  "bon de commande",
  "bulletin de livraison",
  "lieferschein",
  "delivery note",
];

function upper(value: string | null | undefined): string {
  return String(value || "").toUpperCase();
}

function lowerHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p || ""))
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function normalizePartyName(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function partyLooksLikeOwnBusiness(
  party: string | null | undefined,
  ownNames: string[] | null | undefined
): boolean {
  const iss = normalizePartyName(party);
  if (iss.length < 3 || !ownNames?.length) return false;
  return ownNames.some((name) => {
    const nn = normalizePartyName(name);
    if (nn.length < 3) return false;
    return iss.includes(nn) || nn.includes(iss);
  });
}

function categoryLooksLikeIncome(cat: string): boolean {
  return INCOME_CATEGORY_MARKERS.some((m) => cat.includes(m));
}

function categoryLooksLikePayroll(cat: string): boolean {
  return PAYROLL_CATEGORY_MARKERS.some((m) => cat.includes(m));
}

function categoryLooksLikePurchase(cat: string): boolean {
  return PURCHASE_CATEGORY_MARKERS.some((m) => cat.includes(m));
}

function haystackHas(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function isBankLike(docType: string): boolean {
  return (
    docType.includes("BANK STATEMENT") ||
    docType.includes("BANK DEPOSIT") ||
    docType === "BANK STATEMENT" ||
    docType === "BANK DEPOSIT"
  );
}

function isPaySlip(docType: string, cat: string): boolean {
  return docType.includes("PAY SLIP") || docType.includes("PAYSLIP") || categoryLooksLikePayroll(cat);
}

function isTicketOrZ(docType: string): boolean {
  return (
    docType.includes("TICKET") ||
    docType.includes("RECEIPT") ||
    docType.includes("Z2") ||
    docType.includes("Z-READ") ||
    docType.includes("Z READING")
  );
}

/**
 * Classify a document as income (we sold), expense (we bought), salary, or mixed.
 */
export function classifyDocumentDirection(input: DocumentDirectionInput): DocumentFlow {
  const override = upper(input.userFlowOverride);
  if (override === "INCOME") return "INCOME";
  if (override === "EXPENSE") return "EXPENSE";
  if (override === "SALARY") return "SALARY";

  const intent = String(input.uploadIntent || "").toLowerCase();
  if (intent === "revenue") return "INCOME";
  if (intent === "expense") return "EXPENSE";

  const docType = upper(input.documentType);
  const cat = upper(input.expenseCategory);

  if (isBankLike(docType)) return "MIXED";
  if (isPaySlip(docType, cat)) return "SALARY";

  if (categoryLooksLikeIncome(cat)) return "INCOME";

  const ownNames = input.ownBusinessNames || [];
  const issuerIsUs = partyLooksLikeOwnBusiness(input.issuer, ownNames);
  const recipientIsUs = partyLooksLikeOwnBusiness(input.recipient, ownNames);

  if (issuerIsUs && !recipientIsUs) return "INCOME";
  if (recipientIsUs && !issuerIsUs) return "EXPENSE";

  const hay = lowerHaystack([
    input.fileName,
    input.notes,
    input.aiInterpretation,
    input.issuer,
    input.recipient,
    input.documentType,
  ]);

  const supplierSignal = haystackHas(hay, SUPPLIER_WORDING);
  const salesSignal = haystackHas(hay, SALES_WORDING);

  if (supplierSignal && !salesSignal) return "EXPENSE";
  if (salesSignal && !supplierSignal) return "INCOME";

  if (issuerIsUs) return "INCOME";

  const aiHint = upper(input.aiFlowHint);
  if (aiHint === "INCOME" && !supplierSignal) return "INCOME";
  if (aiHint === "EXPENSE" && !salesSignal && !issuerIsUs) return "EXPENSE";

  if (isTicketOrZ(docType) && !supplierSignal) return "INCOME";

  if (categoryLooksLikePurchase(cat)) return "EXPENSE";

  // Invoices default to purchase (supplier bill) unless we already proved we issued them.
  if (docType.includes("INVOICE")) return "EXPENSE";

  return "EXPENSE";
}

export function lineTypeForDocumentFlow(flow: DocumentFlow, existingType?: string | null): LineFlowType {
  if (flow === "INCOME") return "INCOME";
  if (flow === "EXPENSE") return "EXPENSE";
  // MIXED (bank) and SALARY (payslip earnings vs deductions) keep the row type.
  const existing = upper(existingType);
  if (existing === "INCOME") return "INCOME";
  return "EXPENSE";
}

export function forceLineItemType<T extends DirectedLineItem>(item: T, flow: DocumentFlow): T {
  if (flow === "MIXED" || flow === "SALARY") {
    const existing = upper(item.type);
    if (existing === "INCOME" || existing === "EXPENSE") return item;
    return { ...item, type: "EXPENSE" };
  }
  const next = lineTypeForDocumentFlow(flow, item.type);
  if (item.type === next) return item;
  return { ...item, type: next };
}

function categoryForFlow(flow: DocumentFlow, current: string): string {
  const cat = upper(current);
  if (flow === "INCOME") {
    if (categoryLooksLikeIncome(cat)) return current || "REVENUE";
    return "REVENUE";
  }
  if (flow === "SALARY") {
    if (categoryLooksLikePayroll(cat)) return current || "PAYROLL";
    return "PAYROLL";
  }
  if (flow === "EXPENSE") {
    if (categoryLooksLikeIncome(cat) || categoryLooksLikePayroll(cat)) return "OTHER";
    return current || "OTHER";
  }
  return current || "OTHER";
}

/**
 * Force every product/service line (and nested sub-invoices) to follow the
 * parent document. Leaves Bank Statement / Bank Deposit rows mixed.
 */
export function applyDocumentDirectionToFinancialData<T extends DirectedFinancialData>(
  data: T,
  extra?: { ownBusinessNames?: string[]; fileName?: string; uploadIntent?: UploadIntent }
): T {
  const fileName = extra?.fileName || data.sourceFileName || undefined;
  const ownBusinessNames = extra?.ownBusinessNames || undefined;
  const uploadIntent = extra?.uploadIntent || (data.uploadIntent as UploadIntent | undefined);

  const applyOne = (block: DirectedFinancialData, parentFlow?: DocumentFlow): DirectedFinancialData => {
    const flow = classifyDocumentDirection({
      documentType: block.documentType,
      expenseCategory: block.expenseCategory,
      issuer: block.issuer,
      recipient: block.recipient,
      notes: block.notes,
      aiInterpretation: block.aiInterpretation,
      fileName,
      ownBusinessNames,
      userFlowOverride: block.userFlowOverride || data.userFlowOverride,
      uploadIntent,
      aiFlowHint: block.aiFlowHint || data.aiFlowHint,
    });
    const effective = parentFlow && parentFlow !== "MIXED" ? parentFlow : flow;
    const nextCategory = categoryForFlow(effective, String(block.expenseCategory || ""));

    const lineItems = Array.isArray(block.lineItems)
      ? block.lineItems.map((item) => forceLineItemType(item, effective))
      : block.lineItems;

    const subDocuments = Array.isArray(block.subDocuments)
      ? block.subDocuments.map((sub) => {
          const subFlow =
            effective === "MIXED"
              ? classifyDocumentDirection({
                  documentType: sub.documentType || block.documentType,
                  expenseCategory: sub.expenseCategory || nextCategory,
                  issuer: sub.issuer || block.issuer,
                  recipient: sub.recipient || block.recipient,
                  notes: sub.notes,
                  aiInterpretation: sub.aiInterpretation,
                  fileName,
                  ownBusinessNames,
                  userFlowOverride: sub.userFlowOverride || block.userFlowOverride,
                  uploadIntent,
                  aiFlowHint: sub.aiFlowHint || block.aiFlowHint,
                })
              : effective;
          return applyOne(
            {
              ...sub,
              userFlowOverride: sub.userFlowOverride || (effective === "MIXED" ? undefined : effective),
            },
            subFlow
          );
        })
      : block.subDocuments;

    return {
      ...block,
      expenseCategory: nextCategory,
      lineItems,
      subDocuments,
    };
  };

  return applyOne(data) as T;
}

/**
 * Safe stored-document repair: force line types to the parent document’s
 * current direction. Does not rewrite expenseCategory or documentType
 * (never auto-flip a stored sales invoice to expense or vice versa).
 */
export function repairLineItemsToDocumentDirection<T extends DirectedFinancialData>(
  data: T,
  extra?: { ownBusinessNames?: string[]; fileName?: string }
): T {
  const flow = classifyDocumentDirection({
    documentType: data.documentType,
    expenseCategory: data.expenseCategory,
    issuer: data.issuer,
    recipient: data.recipient,
    notes: data.notes,
    aiInterpretation: data.aiInterpretation,
    fileName: extra?.fileName || data.sourceFileName,
    ownBusinessNames: extra?.ownBusinessNames,
    userFlowOverride: data.userFlowOverride,
    uploadIntent: data.uploadIntent,
    aiFlowHint: data.aiFlowHint,
  });
  if (flow === "MIXED" || flow === "SALARY") return data;

  const walk = (block: DirectedFinancialData): DirectedFinancialData => {
    const lineItems = Array.isArray(block.lineItems)
      ? block.lineItems.map((item) => forceLineItemType(item, flow))
      : block.lineItems;
    const subDocuments = Array.isArray(block.subDocuments)
      ? block.subDocuments.map((sub) => walk(sub))
      : block.subDocuments;
    return { ...block, lineItems, subDocuments };
  };

  return walk(data) as T;
}

export function lineItemsConflictWithDocument(
  data: DirectedFinancialData,
  extra?: { ownBusinessNames?: string[]; fileName?: string }
): boolean {
  const flow = classifyDocumentDirection({
    documentType: data.documentType,
    expenseCategory: data.expenseCategory,
    issuer: data.issuer,
    recipient: data.recipient,
    notes: data.notes,
    aiInterpretation: data.aiInterpretation,
    fileName: extra?.fileName || data.sourceFileName,
    ownBusinessNames: extra?.ownBusinessNames,
    userFlowOverride: data.userFlowOverride,
    uploadIntent: data.uploadIntent,
    aiFlowHint: data.aiFlowHint,
  });
  if (flow === "MIXED" || flow === "SALARY") return false;
  const expected = lineTypeForDocumentFlow(flow);
  const walk = (block: DirectedFinancialData): boolean => {
    for (const item of block.lineItems || []) {
      if (item.type && item.type !== expected) return true;
    }
    for (const sub of block.subDocuments || []) {
      if (walk(sub)) return true;
    }
    return false;
  };
  return walk(data);
}

export function isRevenueDocument(
  data: DocumentDirectionInput,
  ownBusinessNames?: string[]
): boolean {
  return (
    classifyDocumentDirection({
      ...data,
      ownBusinessNames: ownBusinessNames || data.ownBusinessNames,
    }) === "INCOME"
  );
}

export function userOverrideFromFlow(flow: DocumentFlow): UserFlowOverride | undefined {
  if (flow === "INCOME") return "INCOME";
  if (flow === "EXPENSE") return "EXPENSE";
  if (flow === "SALARY") return "SALARY";
  return undefined;
}
