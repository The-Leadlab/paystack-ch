import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../context/LanguageContext";
import { useSubscription } from "../context/SubscriptionContext";
import type { PaystackPlanId } from "@shared/planCatalog";
import { PLAN_TEST_PLANS } from "../lib/planTestSelection";
import { PlanMarketingPanel } from "./PlanMarketingPanel";

function planLabel(id: PaystackPlanId, t: (k: string) => string): string {
  if (id === "starter") return t("planStarterName");
  if (id === "business") return t("planBusinessName");
  if (id === "unlimited") return t("planUnlimitedName");
  return id;
}

export function PlanTestPickerModal({
  open,
  required,
  onClose,
}: {
  open: boolean;
  required?: boolean;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const { billing, setPlanTestPlan } = useSubscription();
  const [selected, setSelected] = useState<PaystackPlanId>(billing?.planId ?? "starter");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = async () => {
    setErr(null);
    setBusy(true);
    try {
      await setPlanTestPlan(selected);
      onClose?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !required) onClose?.();
      }}
    >
      <DialogContent className="max-w-lg bg-cdlp-card border-cdlp-border text-white">
        <DialogHeader>
          <DialogTitle className="text-cdlp-gold uppercase tracking-wider text-sm font-black">
            {t("planTestTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-cdlp-muted leading-relaxed">{t("planTestBody")}</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("planTestTitle")}>
          {PLAN_TEST_PLANS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`rounded-md border px-2 py-3 text-[10px] font-black uppercase tracking-tight transition-colors ${
                selected === id
                  ? "border-cdlp-gold/70 bg-cdlp-cream/50 text-white"
                  : "border-cdlp-border bg-cdlp-dark/30 text-cdlp-muted hover:border-cdlp-gold/35 hover:text-white"
              }`}
            >
              {planLabel(id, t)}
            </button>
          ))}
        </div>
        <PlanMarketingPanel planId={selected} variant="cdlp" showMostPopularBadge className="border-cdlp-border/80" />
        {err ? <p className="text-xs text-red-400">{err}</p> : null}
        <DialogFooter className="gap-2 sm:gap-2">
          {!required ? (
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("planTestDismiss")}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            className="bg-cdlp-gold text-cdlp-black font-black uppercase text-xs"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("planTestApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanTestBanner({ onSwitch }: { onSwitch: () => void }) {
  const { t } = useLanguage();
  const { billing, entitlements } = useSubscription();
  const planId = billing?.planId ?? "starter";

  const planName =
    planId === "starter"
      ? t("planStarterName")
      : planId === "business"
        ? t("planBusinessName")
        : planId === "unlimited"
          ? t("planUnlimitedName")
          : planId;

  const docCap =
    entitlements.maxDocumentsPerMonth == null
      ? t("planSummaryUnlimited")
      : String(entitlements.maxDocumentsPerMonth);

  return (
    <div className="w-full max-w-full shrink-0 bg-cdlp-gold/10 border-b border-cdlp-gold/30 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] overflow-hidden">
      <span className="text-cdlp-gold font-bold uppercase tracking-wide leading-snug break-words min-w-0">
        {t("planTestBanner").replace("{plan}", planName).replace("{docs}", docCap)}
      </span>
      <button
        type="button"
        onClick={onSwitch}
        className="text-cdlp-gold underline font-black uppercase text-[10px] hover:text-white shrink-0 self-start sm:self-auto min-h-9 px-1"
      >
        {t("planTestSwitch")}
      </button>
    </div>
  );
}
