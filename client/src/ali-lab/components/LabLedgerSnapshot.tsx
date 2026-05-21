import { Link } from "wouter";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useLabLanguage } from "../context/LabLanguageContext";
import { useAliLabLedger } from "../hooks/useAliLabLedger";
import { formatChf } from "../utils/ledgerTotals";

export function LabLedgerSnapshot() {
  const { t } = useLabLanguage();
  const ledger = useAliLabLedger();

  return (
    <section className="mb-6 rounded-lg border border-border bg-card/80 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40 text-[10px] uppercase font-bold tracking-wider">
        <span>{t("liveFromApp")}</span>
        <div className="flex flex-wrap items-center gap-2 font-normal normal-case">
          <select
            className="border border-border rounded px-2 py-0.5 text-[11px] bg-background max-w-[160px]"
            value={ledger.isAllSessionsView ? "__all__" : ledger.currentSession?.id || ""}
            onChange={(e) => {
              if (e.target.value === "__all__") {
                ledger.setAllSessionsView(true);
                return;
              }
              ledger.setAllSessionsView(false);
              const s = ledger.sessions.find((x) => x.id === e.target.value);
              if (s) ledger.setCurrentSession(s);
            }}
          >
            <option value="__all__">{t("allSessions")}</option>
            {ledger.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => void ledger.refreshFinances()}
            disabled={ledger.loading}
          >
            <RefreshCw className={`size-3 ${ledger.loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/app" className="inline-flex items-center gap-1 text-brand-red font-bold">
            <ExternalLink className="size-3" /> /app
          </Link>
        </div>
      </div>
      <p className="px-3 py-1 text-[10px] text-muted-foreground">
        {ledger.sessionLabel}
        {!ledger.hasFirebaseData && !ledger.loading && ` — ${t("noLedgerYet")}`}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
        <Kpi label={t("income")} value={formatChf(ledger.totalIncome)} tone="positive" />
        <Kpi label={t("expenses")} value={formatChf(ledger.totalExpenses)} tone="negative" />
        <Kpi label={t("payroll")} value={formatChf(ledger.totalPayroll)} tone="muted" />
        <Kpi
          label={t("balance")}
          value={formatChf(ledger.balance)}
          tone={ledger.balance >= 0 ? "positive" : "negative"}
        />
        <Kpi
          label={t("vatNet")}
          value={formatChf(ledger.vatBalance)}
          tone={ledger.vatBalance >= 0 ? "muted" : "negative"}
        />
      </div>
      <p className="px-3 py-2 text-[10px] text-muted-foreground">
        {ledger.incomeCount} {t("incomeRows")} · {ledger.expenseCount} {t("expenseRows")} — {t("labOnlyNote")}
      </p>
    </section>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "muted";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div className="bg-background p-3 text-center">
      <p className="text-[9px] uppercase text-muted-foreground font-bold tracking-wider">{label}</p>
      <p className={`text-sm md:text-base font-black tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
