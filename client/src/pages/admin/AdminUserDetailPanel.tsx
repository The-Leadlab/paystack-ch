import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/cafe/context/LanguageContext";
import {
  getAdminUser,
  runAdminUserAction,
  type AdminUserDetail,
} from "@/lib/adminUsersClient";
import { toast } from "sonner";
import type { PaystackPlanId } from "@shared/planCatalog";

type Props = {
  uid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminUserDetailPanel({ uid, open, onOpenChange, onUserUpdated }: Props) {
  const { t } = useLanguage();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [couponId, setCouponId] = useState("");
  const [planOverride, setPlanOverride] = useState<PaystackPlanId | "none">("none");
  const [planTestMode, setPlanTestMode] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setLinkResult(null);
    try {
      const detail = await getAdminUser(uid);
      setUser(detail);
      setPlanOverride((detail.planId as PaystackPlanId) ?? "none");
      setPlanTestMode(detail.planTestMode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (open && uid) void loadUser();
    if (!open) {
      setUser(null);
      setLinkResult(null);
    }
  }, [open, uid, loadUser]);

  const runAction = async (
    actionKey: string,
    body: Parameters<typeof runAdminUserAction>[1],
    confirmMsg?: string
  ) => {
    if (!uid) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionBusy(actionKey);
    setLinkResult(null);
    try {
      const result = await runAdminUserAction(uid, body);
      toast.success(result.message);
      const link = result.data?.resetLink ?? result.data?.verificationLink;
      if (link) setLinkResult(link);
      await loadUser();
      onUserUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  };

  const planLabel = (id: PaystackPlanId) => {
    if (id === "starter") return t("planStarterName");
    if (id === "business") return t("planBusinessName");
    if (id === "unlimited") return t("planUnlimitedName");
    if (id === "enterprise") return t("planEnterpriseName");
    return id;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{t("adminUserDetailTitle")}</SheetTitle>
          <SheetDescription>{user?.email ?? uid ?? ""}</SheetDescription>
        </SheetHeader>

        {loading || !user ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-brand-red" />
          </div>
        ) : (
          <div className="space-y-6 px-1 pb-8">
            <section className="space-y-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("adminUserSectionAccount")}
              </h3>
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("adminUsersColEmail")}</span>
                  <span className="font-medium text-right break-all">{user.email ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">UID</span>
                  <span className="text-xs font-mono text-right break-all">{user.uid}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("adminUsersColVerified")}</span>
                  <Badge variant={user.emailVerified ? "default" : "outline"}>
                    {user.emailVerified ? t("adminUsersYes") : t("adminUsersNo")}
                  </Badge>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("adminUserProviders")}</span>
                  <span className="text-xs">{user.providerIds.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("adminUsersColLastSignIn")}</span>
                  <span>{formatDateTime(user.lastSignInAt)}</span>
                </div>
                {user.usageThisMonth != null ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("adminUserDocsThisMonth")}</span>
                    <span>{user.usageThisMonth}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("adminUserSectionBilling")}
              </h3>
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-muted-foreground">{t("adminUsersColPlan")}</span>
                  <span className="font-display font-bold uppercase">{user.planId ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-muted-foreground">{t("adminUsersColStatus")}</span>
                  <Badge>{user.subscriptionStatus ?? "none"}</Badge>
                </div>
                {user.stripeSubscription ? (
                  <>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("adminUserPeriodEnd")}</span>
                      <span>{formatDateTime(user.stripeSubscription.currentPeriodEnd)}</span>
                    </div>
                    {user.stripeSubscription.cancelAtPeriodEnd ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{t("adminUserCancelScheduled")}</p>
                    ) : null}
                    {user.stripeSubscription.couponId ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t("adminUserActiveCoupon")}</span>
                        <span className="font-mono text-xs">{user.stripeSubscription.couponId}</span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {user.stripeCustomerId ? (
                  <div className="text-xs text-muted-foreground break-all">
                    Stripe: {user.stripeCustomerId}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.subscriptionId || actionBusy !== null}
                  onClick={() =>
                    void runAction("cancel", { action: "cancel_subscription", atPeriodEnd: true }, t("adminUserConfirmCancel"))
                  }
                >
                  {actionBusy === "cancel" ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  {t("adminUserCancelSub")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.subscriptionId || actionBusy !== null}
                  onClick={() => void runAction("reactivate", { action: "reactivate_subscription" })}
                >
                  {actionBusy === "reactivate" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  {t("adminUserReactivateSub")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.stripeCustomerId || actionBusy !== null}
                  onClick={() =>
                    void runAction("refund", { action: "refund_last_payment" }, t("adminUserConfirmRefund"))
                  }
                >
                  {actionBusy === "refund" ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                  {t("adminUserRefund")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.subscriptionId || !couponId.trim() || actionBusy !== null}
                  onClick={() => void runAction("coupon", { action: "apply_coupon", couponId: couponId.trim() })}
                >
                  {actionBusy === "coupon" ? <Loader2 className="size-3.5 animate-spin" /> : <Tag className="size-3.5" />}
                  {t("adminUserApplyCoupon")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-coupon" className="font-display text-xs">
                  {t("adminUserCouponId")}
                </Label>
                <Input
                  id="admin-coupon"
                  value={couponId}
                  onChange={(e) => setCouponId(e.target.value)}
                  placeholder="SUMMER25"
                  className="font-mono text-sm"
                />
                {user.stripeSubscription?.couponId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={actionBusy !== null}
                    onClick={() => void runAction("removeCoupon", { action: "remove_coupon" })}
                  >
                    {t("adminUserRemoveCoupon")}
                  </Button>
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("adminUserSectionPlanOverride")}
              </h3>
              <div className="flex gap-2">
                <Select value={planOverride} onValueChange={(v) => setPlanOverride(v as PaystackPlanId | "none")}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("adminUserNoPlan")}</SelectItem>
                    {(["starter", "business", "unlimited", "enterprise"] as const).map((id) => (
                      <SelectItem key={id} value={id}>
                        {planLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90"
                  disabled={actionBusy !== null}
                  onClick={() =>
                    void runAction("setPlan", {
                      action: "set_plan",
                      planId: planOverride === "none" ? null : planOverride,
                      planTestMode,
                    })
                  }
                >
                  {actionBusy === "setPlan" ? <Loader2 className="size-3.5 animate-spin" /> : t("adminUserSavePlan")}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={planTestMode}
                  onChange={(e) => setPlanTestMode(e.target.checked)}
                  className="rounded border-border"
                />
                {t("adminUsersTestMode")}
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("adminUserSectionActions")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.email || actionBusy !== null}
                  onClick={() => void runAction("passwordReset", { action: "send_password_reset" })}
                >
                  {actionBusy === "passwordReset" ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                  {t("adminUserPasswordReset")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={!user.email || user.emailVerified || actionBusy !== null}
                  onClick={() => void runAction("verify", { action: "resend_verification" })}
                >
                  {actionBusy === "verify" ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                  {t("adminUserResendVerify")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-display gap-1"
                  disabled={actionBusy !== null}
                  onClick={() =>
                    void runAction(
                      user.disabled ? "enable" : "disable",
                      { action: user.disabled ? "enable_user" : "disable_user" },
                      user.disabled ? undefined : t("adminUserConfirmDisable")
                    )
                  }
                >
                  {actionBusy === "disable" || actionBusy === "enable" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : user.disabled ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Ban className="size-3.5" />
                  )}
                  {user.disabled ? t("adminUserEnable") : t("adminUserDisable")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="font-display gap-1"
                  disabled={actionBusy !== null}
                  onClick={() =>
                    void runAction("delete", { action: "delete_user" }, t("adminUserConfirmDelete"))
                  }
                >
                  {actionBusy === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {t("adminUserDelete")}
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => void loadUser()} disabled={loading}>
                <RefreshCw className="size-3.5" />
                {t("adminUserRefresh")}
              </Button>
            </section>

            {linkResult ? (
              <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <p className="text-xs font-medium">{t("adminUserLinkGenerated")}</p>
                <Input readOnly value={linkResult} className="text-xs font-mono" onFocus={(e) => e.target.select()} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(linkResult);
                    toast.success(t("adminUserLinkCopied"));
                  }}
                >
                  {t("adminUserCopyLink")}
                </Button>
              </section>
            ) : null}

            {user.stripeInvoices.length > 0 ? (
              <section className="space-y-3">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("adminUserSectionInvoices")}
                </h3>
                <div className="rounded-lg border border-border divide-y max-h-48 overflow-y-auto">
                  {user.stripeInvoices.map((inv) => (
                    <div key={inv.id} className="px-3 py-2 text-xs flex justify-between gap-2">
                      <div>
                        <div className="font-mono">{inv.id}</div>
                        <div className="text-muted-foreground">{formatDateTime(inv.created)}</div>
                      </div>
                      <div className="text-right">
                        <div>{formatMoney(inv.amountPaid, inv.currency)}</div>
                        <Badge variant="outline" className="text-[10px]">
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
