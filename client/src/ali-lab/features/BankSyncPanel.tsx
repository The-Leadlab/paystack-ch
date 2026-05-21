import { useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useFinance } from "@/cafe/context/FinanceContext";
import { useSession } from "@/cafe/context/SessionContext";
import { useAuth } from "@/cafe/context/AuthContext";
import { parseBankCsv } from "../utils/parseBankCsv";
import type { LabCsvRow } from "../types";

export function BankSyncPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { user } = useAuth();
  const { addIncome, addExpense } = useFinance();
  const { currentSession } = useSession();
  const [rows, setRows] = useState<LabCsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    setRows(parseBankCsv(text));
    setMessage(`Parsed ${parseBankCsv(text).length} rows`);
  };

  const importToLedger = async () => {
    if (!user) {
      setMessage("Sign in to import into Firestore income/expenses.");
      return;
    }
    if (!currentSession) {
      setMessage("Create or select a session in /app first, then return here.");
      return;
    }
    setImporting(true);
    let ok = 0;
    for (const row of rows) {
      if (row.flow === "INCOME") {
        await addIncome(row.date, "SALES", row.amountChf, row.description, currentSession.id);
      } else {
        await addExpense(row.date, "OTHER", row.amountChf, row.description, currentSession.id);
      }
      ok++;
    }
    setImporting(false);
    setMessage(`Imported ${ok} transactions into session "${currentSession.name}".`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <p className="text-xs text-muted-foreground rounded border border-border p-3">
        Phase A: CSV import (PostFinance / UBS-style). Phase B: bLink Open Banking — not wired in lab yet.
      </p>
      <label className="inline-flex items-center gap-2 text-xs font-bold uppercase text-brand-red cursor-pointer">
        <input
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {t("csvUpload")}
      </label>
      {message && <p className="text-sm font-medium">{message}</p>}
      {rows.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase">{t("preview")} ({rows.length})</p>
          <div className="max-h-48 overflow-auto border border-border rounded text-xs">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-1 text-left">Date</th>
                  <th className="p-1 text-left">Description</th>
                  <th className="p-1 text-right">CHF</th>
                  <th className="p-1">Flow</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-1">{r.date}</td>
                    <td className="p-1">{r.description}</td>
                    <td className="p-1 text-right">{r.amountChf.toLocaleString("de-CH")}</td>
                    <td className="p-1">{r.flow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={importing}
            className="bg-brand-red text-white text-xs font-bold uppercase px-4 py-2 rounded disabled:opacity-50"
            onClick={() => void importToLedger()}
          >
            {importing ? "…" : t("importRows")}
          </button>
        </>
      )}
    </div>
  );
}
