export type LabBudgetMode = "traditional" | "zero-based";

export type LabBudgetLine = {
  id: string;
  month: string;
  category: string;
  budgetChf: number;
  mode: LabBudgetMode;
};

export type LabBill = {
  id: string;
  name: string;
  dueDate: string;
  amountChf: number;
  recurrence: "once" | "monthly" | "yearly";
  remindDaysBefore: number;
};

export type LabGoal = {
  id: string;
  name: string;
  targetChf: number;
  currentChf: number;
  deadline?: string;
  type: "savings" | "debt";
};

export type LabAutomationRule = {
  id: string;
  match: string;
  field: "description" | "issuer";
  category: string;
  flowType: "INCOME" | "EXPENSE";
  enabled: boolean;
};

export type LabHolding = {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  costBasisChf: number;
  lastPriceChf: number;
};

export type LabOfflineQueueItem = {
  id: string;
  fileName: string;
  queuedAt: string;
  status: "queued" | "synced" | "failed";
};

export type LabMember = {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer" | "accountant";
};
