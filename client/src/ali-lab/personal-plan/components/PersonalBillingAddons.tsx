import { useState } from "react";
import { Loader2, Users, FileText } from "lucide-react";
import { useSubscription } from "@/cafe/context/SubscriptionContext";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { isPersonalPlan, PERSONAL_DOC_PACK_CHF, PERSONAL_EXTRA_SEAT_CHF } from "@shared/planCatalog";
import { formatMoney, detectDisplayCurrency } from "@shared/displayCurrency";

/** In-app Personal add-ons: extra seat + 100-doc pack. Shown on personal overview when plan is personal. */
export function PersonalBillingAddons() {
  const { t } = useLanguage();
  const { billing, entitlements, purchasePersonalAddon, openCustomerPortal } = useSubscription();
  const [busy, setBusy] = useState<"seat" | "doc_pack" | "portal" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isPersonalPlan(billing?.planId)) return null;

  const currency = detectDisplayCurrency();
  const seatPrice = formatMoney(PERSONAL_EXTRA_SEAT_CHF, currency);
  const packPrice = formatMoney(PERSONAL_DOC_PACK_CHF, currency);
  const docCap = entitlements.maxPersonalDocumentsPerMonth;
  const seats = entitlements.maxTeamSeats;

  const buy = async (addon: "seat" | "doc_pack") => {
    setBusy(addon);
    setErr(null);
    setMsg(null);
    try {
      const result = await purchasePersonalAddon(addon);
      setMsg(result.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("personalAddonError"));
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      await openCustomerPortal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--pp-outline-variant)] bg-[var(--pp-surface-container)] p-4 md:p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--pp-on-surface)]">
        {t("personalAddonTitle")}
      </h2>
      <p className="text-xs text-[var(--pp-on-surface-variant)] leading-relaxed">
        {t("personalAddonBody")
          .replace("{seats}", seats == null ? "∞" : String(seats))
          .replace("{docs}", docCap == null ? "∞" : String(docCap))}
      </p>
      {msg ? <p className="text-xs text-emerald-600 font-medium">{msg}</p> : null}
      {err ? <p className="text-xs text-red-500 font-medium">{err}</p> : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--pp-outline-variant)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-[var(--pp-on-surface)]">
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">{t("personalAddonSeatTitle")}</span>
          </div>
          <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("personalAddonSeatBody")}</p>
          <p className="text-lg font-bold text-[var(--pp-on-surface)]">
            {seatPrice}
            <span className="text-xs font-normal text-[var(--pp-on-surface-variant)]"> {t("pricingPerMonth")}</span>
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void buy("seat")}
            className="w-full h-10 rounded-md bg-[var(--pp-primary)] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy === "seat" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t("personalAddonSeatCta")}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--pp-outline-variant)] p-4 space-y-3">
          <div className="flex items-center gap-2 text-[var(--pp-on-surface)]">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">{t("personalAddonDocTitle")}</span>
          </div>
          <p className="text-xs text-[var(--pp-on-surface-variant)]">{t("personalAddonDocBody")}</p>
          <p className="text-lg font-bold text-[var(--pp-on-surface)]">
            {packPrice}
            <span className="text-xs font-normal text-[var(--pp-on-surface-variant)]"> {t("pricingPerMonth")}</span>
          </p>
          <button
            type="button"
            disabled={busy !== null || billing?.personalDocPack === true}
            onClick={() => void buy("doc_pack")}
            className="w-full h-10 rounded-md border border-[var(--pp-primary)] text-[var(--pp-primary)] text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy === "doc_pack" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {billing?.personalDocPack ? t("personalAddonDocActive") : t("personalAddonDocCta")}
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void openPortal()}
        className="text-[10px] font-bold uppercase tracking-wider text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-primary)]"
      >
        {busy === "portal" ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
        {t("billingManagePortalCta")}
      </button>
    </section>
  );
}
