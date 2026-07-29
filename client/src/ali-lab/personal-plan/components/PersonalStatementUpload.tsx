import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { useLabLanguage } from "../../context/LabLanguageContext";
import { commitPersonalStatementDrafts } from "../../lib/personalBudgetStore";
import { refinePersonalDraftsWithAi } from "../../lib/personalAiAssist";
import {
  parsePersonalStatementFile,
  personalStatementTemplateCsv,
} from "../../lib/personalStatementImport";
import { downloadTextFile } from "@/cafe/lib/revenueImport";
import { formatChfDisplay } from "../formatChfDisplay";
import { GlassCard } from "./GlassCard";

type Props = {
  onImported: () => void;
};

export function PersonalStatementUpload({ onImported }: Props) {
  const { t } = useLabLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "filling" | "saving">("idle");
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    setErr(null);
    setSuccess(null);
    setBusy(true);
    let totalRows = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const failures: string[] = [];

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setProgress(`${i + 1}/${files.length}: ${file.name}`);
        setPhase("analyzing");
        try {
          const preview = await parsePersonalStatementFile(file);
          if (!preview.rows.length) {
            failures.push(`${file.name}: ${preview.issues[0] || t("stmtAiNoRows")}`);
            continue;
          }
          setPhase("filling");
          const filled = await refinePersonalDraftsWithAi(
            preview.rows.map((r) => ({ ...r, selected: true }))
          );
          setPhase("saving");
          const record = await commitPersonalStatementDrafts(filled, {
            fileName: preview.fileName,
            source: preview.source,
          });
          totalRows += record.rowCount;
          totalIncome += record.incomeTotal;
          totalExpense += record.expenseTotal;
        } catch (e) {
          failures.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (totalRows > 0) {
        setSuccess(
          t("stmtAiImportedBatch")
            .replace("{files}", String(files.length - failures.length))
            .replace("{n}", String(totalRows))
            .replace("{income}", formatChfDisplay(totalIncome))
            .replace("{expense}", formatChfDisplay(totalExpense))
        );
        onImported();
      }
      if (failures.length) {
        setErr(failures.slice(0, 4).join(" · ") + (failures.length > 4 ? ` (+${failures.length - 4})` : ""));
      } else if (totalRows === 0) {
        setErr(t("stmtAiNoRows"));
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
          </p>
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
            disabled={busy}
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
