import type { ReportEmailCadence } from "@shared/reportPeriod";
import type { Expense, Income } from "../types";
import { auth } from "./firebase";

export async function emailFinancialReport(opts: {
  cadence: ReportEmailCadence;
  sessionName: string;
  locale: "en" | "fr";
  includeLedger?: boolean;
  income: Income[];
  expenses: Expense[];
}): Promise<{ sentTo: string }> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to email reports.");
  const token = await user.getIdToken();

  const res = await fetch("/api/reports/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cadence: opts.cadence,
      sessionName: opts.sessionName,
      locale: opts.locale,
      includeLedger: opts.includeLedger,
      income: opts.income.map((i) => ({
        date: i.date,
        amount: i.amount,
        vat_amount: i.vat_amount,
        description: i.description,
        type: i.type,
        account_code: i.account_code,
      })),
      expenses: opts.expenses.map((e) => ({
        date: e.date,
        amount: e.amount,
        vat_amount: e.vat_amount,
        description: e.description,
        category: e.category,
        account_code: e.account_code,
      })),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: string; sentTo?: string };
  if (!res.ok) {
    throw new Error(json.error || `Could not send report (${res.status})`);
  }
  if (!json.sentTo) throw new Error("Report sent but no confirmation email returned.");
  return { sentTo: json.sentTo };
}
