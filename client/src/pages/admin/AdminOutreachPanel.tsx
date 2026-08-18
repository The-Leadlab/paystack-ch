import { useMemo, useRef, useState } from "react";
import { Eye, Loader2, Mail, Send, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { PLATFORM_CONTACT_EMAIL } from "@shared/const";
import {
  OUTREACH_MAX_RECIPIENTS,
  SAMPLE_OUTREACH_CSV,
  mergeOutreachTemplate,
  parseOutreachCsv,
  renderOutreachHtml,
  type OutreachRecipient,
} from "@shared/outreachMail";
import { getOutreachPreset, type OutreachPresetId } from "@shared/outreachPresets";
import { toast } from "sonner";

const CHUNK = 8;

export function AdminOutreachPanel() {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const [recipients, setRecipients] = useState<OutreachRecipient[]>([]);
  const [skipped, setSkipped] = useState<Array<{ row: number; reason: string }>>([]);
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"html" | "text">("html");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState("Ali");
  const [replyTo, setReplyTo] = useState(PLATFORM_CONTACT_EMAIL);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastLog, setLastLog] = useState<string | null>(null);

  const previewHtml = useMemo(() => {
    const rec = recipients[previewIndex] ?? recipients[0];
    if (!rec || !body.trim()) return "";
    const mergedSubject = mergeOutreachTemplate(subject || "Paystack.ch", rec, { sender });
    return renderOutreachHtml({
      mode,
      body,
      recipient: rec,
      sender,
      title: mergedSubject,
    }).html;
  }, [recipients, previewIndex, body, mode, sender, subject]);

  const applyCsv = (text: string) => {
    const parsed = parseOutreachCsv(text);
    const list = parsed.recipients.slice(0, OUTREACH_MAX_RECIPIENTS);
    setRecipients(list);
    setSkipped(parsed.skipped);
    setPreviewIndex(0);
    if (parsed.recipients.length > OUTREACH_MAX_RECIPIENTS) {
      toast.message(t("adminOutreachMax").replace("{n}", String(OUTREACH_MAX_RECIPIENTS)));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    applyCsv(text);
  };

  const loadPreset = (id: OutreachPresetId) => {
    const preset = getOutreachPreset(id);
    setMode(preset.mode);
    setSubject(preset.subject);
    setBody(preset.body);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_OUTREACH_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paystack-outreach-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendAll = async () => {
    if (recipients.length === 0) {
      toast.error(t("adminOutreachNeedRecipients"));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error(t("adminOutreachNeedBody"));
      return;
    }
    setSending(true);
    setLastLog(null);
    const total = recipients.length;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < recipients.length; i += CHUNK) {
        setProgress({ done: Math.min(i, total), total });
        const slice = recipients.slice(i, i + CHUNK);
        const res = await sendAdminOutreach({
          subject,
          mode,
          body,
          sender,
          replyTo,
          recipients: slice,
        });
        sent += res.sent;
        failed += res.failed;
        for (const row of res.results) {
          if (!row.ok) errors.push(`${row.email}: ${row.error || "failed"}`);
        }
      }
      setProgress({ done: total, total });
      const msg =
        t("adminOutreachSent").replace("{ok}", String(sent)).replace("{total}", String(total)) +
        (failed ? ` ${t("adminOutreachSendFailed").replace("{n}", String(failed))}` : "");
      setLastLog([msg, ...errors.slice(0, 12)].join("\n"));
      if (failed) toast.error(msg);
      else toast.success(msg);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setLastLog(err);
      toast.error(err);
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-muted-foreground leading-relaxed rounded-lg border border-border bg-muted/20 px-4 py-3">
        {t("adminOutreachIntro")}
      </p>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-red">
            {t("adminOutreachCsv")}
          </span>
          <p className="text-xs text-muted-foreground pt-1">{t("adminOutreachCsvHint")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="font-display gap-2 min-h-11"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {t("adminOutreachChooseCsv")}
            </Button>
            <Button type="button" variant="secondary" className="font-display min-h-11" onClick={downloadSample}>
              {t("adminOutreachSampleCsv")}
            </Button>
            {recipients.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="font-display min-h-11"
                onClick={() => {
                  setRecipients([]);
                  setSkipped([]);
                }}
              >
                {t("adminOutreachClearList")}
              </Button>
            ) : null}
          </div>
          {skipped.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("adminOutreachSkipped").replace("{n}", String(skipped.length))}
              {": "}
              {skipped
                .slice(0, 4)
                .map((s) => `row ${s.row} (${s.reason})`)
                .join("; ")}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 font-display text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">{t("adminOutreachColName")}</th>
                  <th className="text-left px-3 py-2">{t("adminOutreachColEmail")}</th>
                  <th className="text-left px-3 py-2">{t("adminOutreachColCompany")}</th>
                  <th className="text-left px-3 py-2">{t("adminOutreachColExtra")}</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-muted-foreground text-center">
                      {t("adminOutreachEmptyList")}
                    </td>
                  </tr>
                ) : (
                  recipients.map((r, idx) => (
                    <tr key={`${r.email}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2">{r.name || "—"}</td>
                      <td className="px-3 py-2 break-all">{r.email}</td>
                      <td className="px-3 py-2">{r.company || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.extra || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setRecipients((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={t("adminOutreachRemove")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("adminOutreachRecipients")}: {recipients.length} / {OUTREACH_MAX_RECIPIENTS}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-brand-red">
            {t("adminOutreachTitle")}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="outreach-subject">{t("adminOutreachSubject")}</Label>
              <Input
                id="outreach-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="font-editorial"
                placeholder="A private beta for Geneva SMEs / Une bêta privée…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-sender">{t("adminOutreachSender")}</Label>
              <Input id="outreach-sender" value={sender} onChange={(e) => setSender(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-reply">{t("adminOutreachReplyTo")}</Label>
              <Input
                id="outreach-reply"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["html", "text"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`px-3 py-2 rounded-lg font-display text-sm border min-h-11 ${
                  mode === id
                    ? "border-brand-red bg-brand-red/10 text-brand-red"
                    : "border-border text-muted-foreground"
                }`}
              >
                {id === "html" ? t("adminOutreachModeHtml") : t("adminOutreachModeText")}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outreach-preset">{t("adminOutreachPreset")}</Label>
            <select
              id="outreach-preset"
              className="w-full h-11 rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value as OutreachPresetId | "";
                if (id) loadPreset(id);
              }}
            >
              <option value="" disabled>
                {t("adminOutreachPreset")}
              </option>
              <option value="beta-invite">{t("adminOutreachPresetInvite")}</option>
              <option value="beta-direct">{t("adminOutreachPresetDirect")}</option>
              <option value="blank-html">{t("adminOutreachPresetBlankHtml")}</option>
              <option value="blank-text">{t("adminOutreachPresetBlankText")}</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outreach-body">{t("adminOutreachBody")}</Label>
            <p className="text-xs text-muted-foreground">{t("adminOutreachTags")}</p>
            <Textarea
              id="outreach-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[280px] font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="font-display gap-2 min-h-11"
              disabled={!body.trim() || recipients.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="size-4" />
              {t("adminOutreachPreview")}
            </Button>
            <Button
              type="button"
              className="font-display gap-2 min-h-11 bg-brand-red text-white hover:bg-brand-red/90"
              disabled={sending || recipients.length === 0 || !body.trim() || !subject.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending
                ? progress
                  ? `${t("adminOutreachSending")} ${progress.done}/${progress.total}`
                  : t("adminOutreachSending")
                : t("adminOutreachSend")}
            </Button>
          </div>
          {lastLog ? (
            <pre className="text-xs whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3">{lastLog}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Mail className="size-4 text-brand-red" />
              {t("adminOutreachPreview")}
            </DialogTitle>
            <DialogDescription>{t("adminOutreachPreviewFor")}</DialogDescription>
          </DialogHeader>
          {recipients.length > 0 ? (
            <select
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              value={String(previewIndex)}
              onChange={(e) => setPreviewIndex(Number(e.target.value))}
            >
              {recipients.map((r, i) => (
                <option key={r.email} value={i}>
                  {r.name || r.email} — {r.email}
                </option>
              ))}
            </select>
          ) : null}
          {previewHtml ? (
            <iframe
              title={t("adminOutreachPreview")}
              sandbox=""
              srcDoc={previewHtml}
              className="w-full h-[65vh] rounded-md border border-border bg-white"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("adminOutreachPreviewEmpty")}</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminOutreachConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminOutreachConfirmBody").replace("{n}", String(recipients.length))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminUsersConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red text-white hover:bg-brand-red/90"
              onClick={() => void sendAll()}
            >
              {t("adminOutreachSend")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
