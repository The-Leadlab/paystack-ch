import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Receipt, AlertTriangle, Banknote, Camera, Loader2, Sparkles, X } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabBill } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { usePersonalBudgetLedger } from "../hooks/usePersonalBudgetLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import { formatChfDisplay } from "../personal-plan/formatChfDisplay";
import { fileToCompressedDataUrl } from "../lib/personalImageCompress";
import { PERSONAL_RECEIPT_AI_HINT } from "../lib/personalSwissTaxAi";
import { analyzeFinancialDocument } from "@/cafe/services/geminiService";

function annualizedChf(b: LabBill): number {
  if (b.recurrence === "weekly") return b.amountChf * 52;
  if (b.recurrence === "biweekly") return b.amountChf * 26;
  if (b.recurrence === "monthly") return b.amountChf * 12;
  if (b.recurrence === "yearly") return b.amountChf;
  return b.amountChf;
}

function recurrenceLabel(recurrence: LabBill["recurrence"], t: (k: string) => string): string {
  const map: Record<LabBill["recurrence"], string> = {
    once: t("billFreqOnce"),
    weekly: t("billFreqWeekly"),
    biweekly: t("billFreqBiweekly"),
    monthly: t("billFreqMonthly"),
    yearly: t("billFreqYearly"),
  };
  return map[recurrence];
}

const DEMO_BILL_IDS = new Set(["seed-1", "seed-2"]);

export function BillRemindersPanel({ feature }: { feature: AliLabFeature }) {
  const { t, summary } = useLabFeatureText(feature);
  const { month, openTransaction } = usePersonalPlan();
  const ledger = usePersonalBudgetLedger(month);
  const { items, add, remove, update, setItems, uid, loading } = useAliLabPersist<LabBill>(
    labCollections.bills,
    "bills",
    []
  );

  const photoRef = useRef<HTMLInputElement>(null);
  const cleanedDemos = useRef(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [recurrence, setRecurrence] = useState<LabBill["recurrence"]>("monthly");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  /** Drop hardcoded demo bills from older builds. */
  useEffect(() => {
    if (loading || cleanedDemos.current) return;
    const demos = items.filter((b) => DEMO_BILL_IDS.has(b.id));
    cleanedDemos.current = true;
    if (!demos.length) return;
    setItems(items.filter((b) => !DEMO_BILL_IDS.has(b.id)));
  }, [items, loading, setItems]);

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(() => {
    return [...items]
      .filter((b) => !DEMO_BILL_IDS.has(b.id))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((b) => {
        const due = new Date(b.dueDate);
        const now = new Date(today);
        const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
        const paidInLedger = ledger.monthRows.some(
          (e) =>
            e.kind === "expense" &&
            e.description?.toLowerCase().includes(b.name.toLowerCase().slice(0, 4))
        );
        return { ...b, days, overdue: days < 0, paidInLedger, annualChf: annualizedChf(b) };
      });
  }, [items, today, ledger.monthRows]);

  const logPayment = (bill: LabBill) => {
    openTransaction({
      kind: "expense",
      amount: bill.amountChf,
      description: bill.name,
      expenseCat: "BILLS",
      date: today,
    });
  };

  const clearReceipt = () => {
    setReceiptDataUrl(undefined);
    setReceiptFileName(undefined);
    setPendingPhotoFile(null);
    if (photoRef.current) photoRef.current.value = "";
  };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setAiMsg(null);
    try {
      const { dataUrl, fileName } = await fileToCompressedDataUrl(file);
      setReceiptDataUrl(dataUrl);
      setReceiptFileName(fileName);
      setPendingPhotoFile(file);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const fillFromPhotoAi = async () => {
    if (!pendingPhotoFile && !receiptDataUrl) {
      setFormError(t("billNeedPhoto"));
      return;
    }
    setAiBusy(true);
    setAiMsg(null);
    setFormError(null);
    try {
      let file = pendingPhotoFile;
      if (!file && receiptDataUrl) {
        const res = await fetch(receiptDataUrl);
        const blob = await res.blob();
        file = new File([blob], receiptFileName || "receipt.jpg", { type: blob.type || "image/jpeg" });
      }
      if (!file) throw new Error(t("billNeedPhoto"));
      const data = await analyzeFinancialDocument(file, "CHF", PERSONAL_RECEIPT_AI_HINT);
      const issuer = (data.issuer || "").trim();
      const amount = data.amountInCHF || data.totalAmount || 0;
      const date = (data.date || "").trim();
      if (issuer) setName(issuer);
      if (amount > 0) setAmountInput(String(Math.round(amount * 100) / 100));
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setDueDate(date);
      else if (!dueDate) setDueDate(today);
      setAiMsg(t("billAiFilled"));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  };

  const submitBill = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError(t("billNeedName"));
      return;
    }
    if (!dueDate) {
      setFormError(t("billNeedDue"));
      return;
    }
    const amountChf = Number(amountInput.replace(",", "."));
    if (!Number.isFinite(amountChf) || amountChf <= 0) {
      setFormError(t("billNeedAmount"));
      return;
    }
    void add({
      name: name.trim(),
      dueDate,
      amountChf,
      recurrence,
      remindDaysBefore: 14,
      ...(receiptDataUrl ? { receiptDataUrl, receiptFileName } : {}),
    });
    setName("");
    setDueDate("");
    setAmountInput("");
    setRecurrence("monthly");
    clearReceipt();
    setAiMsg(null);
  };

  const editBill = (bill: LabBill) => {
    const nextName = prompt(t("billPlaceholder"), bill.name);
    if (nextName == null || !nextName.trim()) return;
    const nextAmount = prompt(t("billAmountPrompt"), String(bill.amountChf));
    if (nextAmount == null) return;
    const parsed = Number(nextAmount);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const nextDue = prompt(t("billDuePrompt"), bill.dueDate);
    if (nextDue == null || !nextDue.trim()) return;
    const nextRec = prompt(
      `${t("billFrequency")} (once|weekly|biweekly|monthly|yearly)`,
      bill.recurrence
    );
    const allowed: LabBill["recurrence"][] = ["once", "weekly", "biweekly", "monthly", "yearly"];
    const rec = allowed.includes(nextRec as LabBill["recurrence"])
      ? (nextRec as LabBill["recurrence"])
      : bill.recurrence;
    void update(bill.id, {
      name: nextName.trim(),
      amountChf: parsed,
      dueDate: nextDue.trim(),
      recurrence: rec,
    });
  };

  const totalAnnual = upcoming.reduce((s, b) => s + b.annualChf, 0);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">{t("billsTitle")}</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2">{summary}</p>
      </section>

      <GlassCard className="p-4 flex flex-wrap items-center gap-4">
        <Receipt className="size-5 text-[var(--pp-primary)] shrink-0" />
        <p className="text-sm text-[var(--pp-on-surface-variant)]">
          {t("annualCost")}: <strong className="text-[var(--pp-on-surface)]">{formatChfDisplay(totalAnnual)}</strong>{" "}
          {t("committedRecurringSuffix")}
        </p>
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            className="pp-input px-3 py-2 flex-1 min-w-[120px] text-sm"
            placeholder={t("billPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="date"
            className="pp-input px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.05"
            className="pp-input px-3 py-2 w-28 text-sm pp-tabular"
            placeholder={t("billAmountPlaceholder")}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
          <select
            className="pp-input px-2 py-2 text-sm min-w-[110px]"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as LabBill["recurrence"])}
            aria-label={t("billFrequency")}
          >
            <option value="once">{t("billFreqOnce")}</option>
            <option value="weekly">{t("billFreqWeekly")}</option>
            <option value="biweekly">{t("billFreqBiweekly")}</option>
            <option value="monthly">{t("billFreqMonthly")}</option>
            <option value="yearly">{t("billFreqYearly")}</option>
          </select>
          <button
            type="button"
            className="bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] px-4 py-2 rounded-lg text-xs font-bold"
            onClick={submitBill}
          >
            {t("addBill")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--pp-outline-variant)] text-[11px] font-semibold"
            onClick={() => photoRef.current?.click()}
          >
            <Camera className="size-3.5" />
            {t("billAttachPhoto")}
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={aiBusy || (!pendingPhotoFile && !receiptDataUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pp-primary)]/10 text-[var(--pp-primary)] text-[11px] font-bold disabled:opacity-40"
            onClick={() => void fillFromPhotoAi()}
          >
            {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {t("billAiFromPhoto")}
          </button>
          {receiptDataUrl ? (
            <div className="relative inline-flex items-center gap-2">
              <img
                src={receiptDataUrl}
                alt=""
                className="h-12 w-12 rounded object-cover border border-[var(--pp-outline-variant)]"
              />
              <span className="text-[10px] text-[var(--pp-on-surface-variant)] max-w-[120px] truncate">
                {receiptFileName}
              </span>
              <button type="button" className="p-1 text-[var(--pp-on-surface-variant)]" onClick={clearReceipt} aria-label={t("delete")}>
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--pp-on-surface-variant)]">{t("billPhotoHint")}</p>
          )}
        </div>

        {formError && <p className="text-xs text-[var(--pp-error)]">{formError}</p>}
        {aiMsg && <p className="text-xs text-[var(--pp-tertiary)]">{aiMsg}</p>}
      </GlassCard>

      <div className="space-y-3">
        {upcoming.length === 0 && (
          <p className="text-sm text-[var(--pp-on-surface-variant)]">{t("billsEmpty")}</p>
        )}
        {upcoming.map((b) => (
          <GlassCard
            key={b.id}
            className={`p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 ${
              b.overdue
                ? "border-[var(--pp-error)]/50"
                : b.days <= b.remindDaysBefore
                  ? "border-[var(--pp-primary)]/40"
                  : ""
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              {b.receiptDataUrl ? (
                <img
                  src={b.receiptDataUrl}
                  alt=""
                  className="size-12 rounded object-cover shrink-0 border border-[var(--pp-outline-variant)]"
                />
              ) : b.overdue ? (
                <AlertTriangle className="size-5 text-[var(--pp-error)] shrink-0 mt-0.5" />
              ) : (
                <Calendar className="size-5 text-[var(--pp-tertiary)] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{b.name}</p>
                <p className="text-xs text-[var(--pp-on-surface-variant)]">
                  {t("due")} {b.dueDate}
                  <span className="mx-1">·</span>
                  {recurrenceLabel(b.recurrence, t)}
                  {b.paidInLedger && (
                    <span className="text-[var(--pp-secondary)] ml-2 font-semibold uppercase text-[10px]">
                      {t("paidInLedger")}
                    </span>
                  )}
                </p>
                {b.overdue ? (
                  <span className="text-[11px] text-[var(--pp-error)] font-bold uppercase">{t("overdue")}</span>
                ) : (
                  <span className="text-[11px] text-[var(--pp-on-surface-variant)]">
                    {b.days} {t("daysUntil")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <div className="text-right pp-tabular">
                <p className="font-semibold">{formatChfDisplay(b.amountChf)}</p>
                <p className="text-[10px] text-[var(--pp-on-surface-variant)]">
                  {formatChfDisplay(b.annualChf, { prefix: false })}
                  {t("perYear")}
                </p>
              </div>
              {!b.paidInLedger ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--pp-secondary)] px-2 py-1 rounded bg-[var(--pp-secondary)]/10"
                  onClick={() => logPayment(b)}
                >
                  <Banknote className="size-3" />
                  {t("billLogPayment")}
                </button>
              ) : null}
              <button
                type="button"
                className="text-[11px] text-[var(--pp-on-surface-variant)] underline"
                onClick={() => editBill(b)}
              >
                {t("edit")}
              </button>
              <button
                type="button"
                className="text-[11px] text-[var(--pp-error)] underline"
                onClick={() => {
                  if (confirm(t("billDeleteConfirm").replace("{name}", b.name))) void remove(b.id);
                }}
              >
                {t("delete")}
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
      {!uid && <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("localOnly")}</p>}
    </div>
  );
}
