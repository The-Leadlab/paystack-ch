import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { usePersonalBudgetLedger } from "../../hooks/usePersonalBudgetLedger";
import { refinePersonalDraftsWithAi } from "../../lib/personalAiAssist";
import {
  dominantMonthFromDrafts,
  parsePersonalStatementFile,
  personalStatementTemplateCsv,
} from "../../lib/personalStatementImport";
import { enrichPersonalFromStatement } from "../../lib/personalStatementEnrich";
import { backupPersonalStatementToGoogleDrive } from "../../lib/personalStatementDriveBackup";
import {
  ensureDefaultPersonalSession,
  recordPersonalSessionImport,
} from "../../lib/personalSessionsStore";
import { downloadTextFile } from "@/cafe/lib/revenueImport";
import { formatChfDisplay } from "../formatChfDisplay";
import { GlassCard } from "./GlassCard";
import { useSubscription } from "@/cafe/context/SubscriptionContext";
import { useWorkspaceOptional } from "@/cafe/context/WorkspaceContext";
import { auth } from "@/cafe/lib/firebase";
import { usePersonalPlan } from "../context/PersonalPlanContext";
import { PERSONAL_BASE_DOC_LIMIT } from "@shared/planCatalog";

type Props = {
  onImported: (meta?: { month?: string; rowCount?: number }) => void;
};

export function PersonalStatementUpload({ onImported }: Props) {
  const { t } = useLabLanguage();
  const ledger = usePersonalBudgetLedger();
  const { setMonth } = usePersonalPlan();
  const workspace = useWorkspaceOptional();
  const {
    entitlements,
    personalDocumentsUsedThisMonth,
    incrementPersonalDocumentUsage,
  } = useSubscription();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "filling" | "saving">("idle");
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Hard ceiling across all personal sessions (default 35). */
  const personalCap = entitlements.maxPersonalDocumentsPerMonth ?? PERSONAL_BASE_DOC_LIMIT;
  const usedAcrossSessions = Math.max(ledger.totalImportCount, personalDocumentsUsedThisMonth);
  const remainingSlots = Math.max(0, personalCap - usedAcrossSessions);
  const personalAtCap = remainingSlots <= 0;

  const onFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    setErr(null);
    setSuccess(null);

    if (personalAtCap) {
      const msg = `Personal plan allows up to ${personalCap} document upload(s) across all sessions.`;
      setErr(msg);
      toast.error(msg);
      return;
    }

    const toProcess = files.slice(0, remainingSlots);
    if (toProcess.length < files.length) {
      setErr(
        `Only ${remainingSlots} personal upload(s) left (cap ${personalCap} across all sessions). Processing first ${toProcess.length} file(s).`
      );
    }

    setBusy(true);
    let totalRows = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const failures: string[] = [];
    let jumpMonth: string | null = null;
    const ownerUid = workspace?.dataOwnerUid || auth?.currentUser?.uid || undefined;
    const session = await ensureDefaultPersonalSession();

    try {
      for (let i = 0; i < toProcess.length; i += 1) {
        const file = toProcess[i];
        setProgress(`${i + 1}/${toProcess.length}: ${file.name}`);
        setPhase("analyzing");
        toast.message(`Analyzing ${file.name}…`);
        try {
          const preview = await parsePersonalStatementFile(file);
          if (!preview.rows.length) {
            const reason = preview.issues[0] || t("stmtAiNoRows");
            failures.push(`${file.name}: ${reason}`);
            toast.error(`${file.name}: ${reason}`);
            continue;
          }
          if (preview.issues.some((x) => /on-device PDF text|AI:/i.test(x))) {
            toast.message("AI unavailable or empty — used PDF text extraction.");
          }
          setPhase("filling");
          const filled = await refinePersonalDraftsWithAi(
            preview.rows.map((r) => ({ ...r, selected: true }))
          );
          setPhase("saving");

          const built = await ledger.commitStatement(filled, {
            fileName: preview.fileName,
            source: preview.source,
            sessionId: session.id,
          });
          const record = built.record;

          totalRows += record.rowCount;
          totalIncome += record.incomeTotal;
          totalExpense += record.expenseTotal;
          const monthKey = dominantMonthFromDrafts(filled);
          if (monthKey) jumpMonth = monthKey;

          await recordPersonalSessionImport(session.id, record.id);
          await incrementPersonalDocumentUsage();

          const enrich = await enrichPersonalFromStatement(ownerUid, filled, {
            month: monthKey || undefined,
          });
          if (enrich.billsAdded || enrich.goalsAdded || enrich.holdingsAdded || enrich.budgetsTouched) {
            toast.success(
              `AI filled · bills +${enrich.billsAdded} · goals +${enrich.goalsAdded} · investments +${enrich.holdingsAdded} · budgets +${enrich.budgetsTouched}`
            );
            window.dispatchEvent(new Event("ali-lab-data-changed"));
          }

          const statementDate =
            filled.find((r) => r.selected && /^\d{4}-\d{2}-\d{2}/.test(r.date))?.date ||
            new Date().toISOString().slice(0, 10);
          const driveStatus = await backupPersonalStatementToGoogleDrive(file, ownerUid, {
            documentDate: statementDate,
            sessionId: session.id,
          });
          if (driveStatus === "skipped-duplicate") {
            toast.message("Google Drive: file already backed up in this session.");
          }

          ledger.bump();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push(`${file.name}: ${msg}`);
          toast.error(`${file.name}: ${msg}`);
        }
      }

      if (totalRows > 0) {
        if (jumpMonth) setMonth(jumpMonth);
        const msg = t("stmtAiImportedBatch")
          .replace("{files}", String(toProcess.length - failures.length))
          .replace("{n}", String(totalRows))
          .replace("{income}", formatChfDisplay(totalIncome))
          .replace("{expense}", formatChfDisplay(totalExpense));
        setSuccess(msg);
        toast.success(msg);
        onImported({ month: jumpMonth || undefined, rowCount: totalRows });
        await ledger.refresh();
      }
      if (failures.length) {
        setErr(failures.slice(0, 4).join(" · ") + (failures.length > 4 ? ` (+${failures.length - 4})` : ""));
      } else if (totalRows === 0) {
        setErr(t("stmtAiNoRows"));
        toast.error(t("stmtAiNoRows"));
      }
    } finally {
      setBusy(false);
      setPhase("idle");
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const phaseLabel =
    phase === "analyzing"
      ? t("stmtAiAnalyzing")
      : phase === "filling"
        ? t("stmtAiFilling")
        : phase === "saving"
          ? t("stmtAiSaving")
          : null;

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{t("stmtUploadTitle")}</p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1 max-w-xl">
            {t("stmtAiUploadHint")}
            {` · ${usedAcrossSessions}/${personalCap} uploads across all sessions`}
          </p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1">{t("stmtMonthJumpHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--pp-outline-variant)] text-[11px] font-semibold"
            onClick={() => downloadTextFile("personal-statement-template.csv", personalStatementTemplateCsv())}
          >
            <FileUp className="size-3.5" />
            {t("stmtDownloadTemplate")}
          </button>
          <button
            type="button"
            disabled={busy || personalAtCap}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold hover:opacity-90 disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t("stmtUploadCta")}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,text/csv,.pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp,.heic"
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </div>
      </div>

      {busy && (phaseLabel || progress) && (
        <p className="text-xs text-[var(--pp-primary)] inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          {phaseLabel}
          {progress ? ` · ${progress}` : null}
        </p>
      )}
      {err && <p className="text-xs text-[var(--pp-error)]">{err}</p>}
      {success && (
        <p className="text-xs text-[var(--pp-tertiary)] inline-flex items-center gap-2">
          <CheckCircle2 className="size-3.5 shrink-0" />
          {success}
        </p>
      )}
    </GlassCard>
  );
}
