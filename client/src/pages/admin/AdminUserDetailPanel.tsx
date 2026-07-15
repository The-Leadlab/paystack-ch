import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  adminOutlineBtnClass,
  adminPanelCardClass,
  subscriptionStatusClass,
} from "./adminUserUi";

type Props = {
  uid: string;
  onBack: () => void;
  onUserUpdated: () => void;
};

type DetailTab = "profile" | "billing" | "actions" | "invoices";

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

export function AdminUserDetailPanel({ uid, onBack, onUserUpdated }: Props) {
  const { t } = useLanguage();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>("profile");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [couponId, setCouponId] = useState("");
  const [planOverride, setPlanOverride] = useState<PaystackPlanId | "none">("none");
  const [planTestMode, setPlanTestMode] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editDisabled, setEditDisabled] = useState(false);
  const [actionPassword, setActionPassword] = useState("");

  const loadUser = useCallback(async () => {
    setLoading(true);
    setLinkResult(null);
    try {
      const detail = await getAdminUser(uid);
      setUser(detail);
      setPlanOverride((detail.planId as PaystackPlanId) ?? "none");
      setPlanTestMode(detail.planTestMode);
      setEditDisplayName(detail.displayName ?? "");
      setEditEmail(detail.email ?? "");
      setEditPassword("");
      setEditPhone(detail.phoneNumber ?? "");
      setEditEmailVerified(detail.emailVerified);
      setEditDisabled(detail.disabled);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const runAction = async (
    actionKey: string,
    body: Parameters<typeof runAdminUserAction>[1],
    confirmMsg?: string
  ) => {
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

  const saveProfile = async () => {
    if (!user) return;
    const canEditEmail = user.providerIds.includes("password") || user.providerIds.length === 0;
    setActionBusy("saveProfile");
    try {
      const result = await runAdminUserAction(uid, {
        action: "update_user",
        displayName: editDisplayName,
        ...(canEditEmail ? { email: editEmail } : {}),
        ...(editPassword.trim() ? { password: editPassword } : {}),
        phoneNumber: editPhone,
        emailVerified: editEmailVerified,
        disabled: editDisabled,
      });
      toast.success(result.message);
      setEditPassword("");
      await loadUser();
      onUserUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  };

  const setPassword = async () => {
    const pwd = actionPassword.trim();
    if (pwd.length < 6) {
      toast.error(t("adminUserPasswordTooShort"));
      return;
    }
    setActionBusy("setPassword");
    try {
      const result = await runAdminUserAction(uid, { action: "set_password", password: pwd });
      toast.success(result.message);
      setActionPassword("");
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

  const isPasswordUser = user?.providerIds.includes("password");
  const canEditEmail = isPasswordUser || (user?.providerIds.length ?? 0) === 0;
  const canSetPassword = Boolean(user?.email);

  const detailTabs: { id: DetailTab; label: string }[] = [
    { id: "profile", label: t("adminUserTabProfile") },
    { id: "billing", label: t("adminUserTabBilling") },
    { id: "actions", label: t("adminUserTabActions") },
    { id: "invoices", label: t("adminUserTabInvoices") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-display gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            {t("adminUserBackToList")}
          </Button>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-foreground truncate">
              {user?.displayName || user?.email || uid}
            </h2>
            {user?.displayName && user.email ? (
              <p className="text-sm text-muted-foreground break-all">{user.email}</p>
            ) : null}
            <p className="text-[11px] font-mono text-muted-foreground break-all">{uid}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`${adminOutlineBtnClass} shrink-0`}
          onClick={() => void loadUser()}
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("adminUserRefresh")}
        </Button>
      </div>

      {loading || !user ? (
        <div className="flex items-center justify-center py-24 rounded-xl border border-border bg-card">
          <Loader2 className="size-8 animate-spin text-brand-red" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)} className="gap-6">
          <TabsList className="w-full h-auto gap-1.5 bg-muted/60 p-1.5 grid grid-cols-2 sm:flex sm:flex-wrap sm:w-auto">
            {detailTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="font-display data-[state=active]:bg-card data-[state=active]:text-foreground px-3 sm:px-4 py-2.5 min-h-11 text-xs sm:text-sm touch-manipulation"
              >
                {tab.label}
                {tab.id === "invoices" && user.stripeInvoices.length > 0 ? (
                  <span className="ml-1 text-[10px] opacity-70">({user.stripeInvoices.length})</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="mt-0 space-y-4">
            <div className={`${adminPanelCardClass} space-y-4`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-display-name" className="font-display text-xs">
                    {t("adminUserDisplayName")}
                  </Label>
                  <Input
                    id="edit-display-name"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="font-display text-xs">
                    {t("adminUsersColEmail")}
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="bg-background"
                    disabled={!canEditEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="font-display text-xs">
                    {t("adminUserPhone")}
                  </Label>
                  <Input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-password" className="font-display text-xs">
                    {t("adminUserNewPassword")}
                  </Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder={t("adminUserPasswordPlaceholder")}
                    className="bg-background"
                    minLength={6}
                    disabled={!canSetPassword}
                  />
                </div>
              </div>
              {!canEditEmail && user.providerIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">{t("adminUserEmailOAuthHint")}</p>
              ) : null}
              {canSetPassword && !isPasswordUser && user.providerIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">{t("adminUserPasswordOAuthHint")}</p>
              ) : null}
              {!canSetPassword ? (
                <p className="text-xs text-muted-foreground">{t("adminUserNoEmailForPassword")}</p>
              ) : null}
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEmailVerified}
                    onChange={(e) => setEditEmailVerified(e.target.checked)}
                  />
                  {t("adminUserMarkVerified")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDisabled}
                    onChange={(e) => setEditDisabled(e.target.checked)}
                  />
                  {t("adminUserCreateDisabled")}
                </label>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                <span>{t("adminUserProviders")}: {user.providerIds.join(", ") || "—"}</span>
                <span>{t("adminUsersColLastSignIn")}: {formatDateTime(user.lastSignInAt)}</span>
                {user.usageThisMonth != null ? (
                  <span>{t("adminUserDocsThisMonth")}: {user.usageThisMonth}</span>
                ) : null}
              </div>
              <Button
                type="button"
                className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                disabled={actionBusy !== null}
                onClick={() => void saveProfile()}
              >
                {actionBusy === "saveProfile" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("adminUserSaveProfile")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 space-y-4">
            <div className={`${adminPanelCardClass} space-y-3 text-sm`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex justify-between gap-2 items-center sm:flex-col sm:items-start">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">{t("adminUsersColPlan")}</span>
                  <span className="font-display font-bold uppercase text-foreground">{user.planId ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2 items-center sm:flex-col sm:items-start">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">{t("adminUsersColStatus")}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${subscriptionStatusClass(user.subscriptionStatus)}`}>
                    {user.subscriptionStatus ?? "none"}
                  </span>
                </div>
              </div>
              {user.stripeSubscription ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("adminUserPeriodEnd")}</span>
                    <span className="text-foreground">{formatDateTime(user.stripeSubscription.currentPeriodEnd)}</span>
                  </div>
                  {user.stripeSubscription.cancelAtPeriodEnd ? (
                    <p className="text-xs text-amber-600 dark:text-amber-300">{t("adminUserCancelScheduled")}</p>
                  ) : null}
                  {user.stripeSubscription.couponId ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("adminUserActiveCoupon")}</span>
                      <span className="font-mono text-xs">{user.stripeSubscription.couponId}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {user.stripeCustomerId ? (
                <p className="text-xs text-muted-foreground break-all border-t border-border pt-3">
                  Stripe customer: {user.stripeCustomerId}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.subscriptionId || actionBusy !== null}
                onClick={() => void runAction("cancel", { action: "cancel_subscription", atPeriodEnd: true }, t("adminUserConfirmCancel"))}>
                {actionBusy === "cancel" ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                {t("adminUserCancelSub")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.subscriptionId || actionBusy !== null}
                onClick={() => void runAction("reactivate", { action: "reactivate_subscription" })}>
                {actionBusy === "reactivate" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                {t("adminUserReactivateSub")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.stripeCustomerId || actionBusy !== null}
                onClick={() => void runAction("refund", { action: "refund_last_payment" }, t("adminUserConfirmRefund"))}>
                {actionBusy === "refund" ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                {t("adminUserRefund")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.subscriptionId || !couponId.trim() || actionBusy !== null}
                onClick={() => void runAction("coupon", { action: "apply_coupon", couponId: couponId.trim() })}>
                {actionBusy === "coupon" ? <Loader2 className="size-3.5 animate-spin" /> : <Tag className="size-3.5" />}
                {t("adminUserApplyCoupon")}
              </Button>
            </div>

            <div className={`${adminPanelCardClass} space-y-3`}>
              <Label htmlFor="admin-coupon" className="font-display text-xs">{t("adminUserCouponId")}</Label>
              <Input id="admin-coupon" value={couponId} onChange={(e) => setCouponId(e.target.value)} placeholder="SUMMER25" className="font-mono text-sm bg-background" />
              {user.stripeSubscription?.couponId ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={actionBusy !== null}
                  onClick={() => void runAction("removeCoupon", { action: "remove_coupon" })}>
                  {t("adminUserRemoveCoupon")}
                </Button>
              ) : null}
            </div>

            <div className={`${adminPanelCardClass} space-y-3`}>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("adminUserSectionPlanOverride")}</p>
              <div className="flex gap-2">
                <Select value={planOverride} onValueChange={(v) => setPlanOverride(v as PaystackPlanId | "none")}>
                  <SelectTrigger className="flex-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border">
                    <SelectItem value="none">{t("adminUserNoPlan")}</SelectItem>
                    {(["starter", "business", "unlimited", "enterprise"] as const).map((id) => (
                      <SelectItem key={id} value={id}>{planLabel(id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" className="font-display bg-brand-red text-white hover:bg-brand-red/90 shrink-0" disabled={actionBusy !== null}
                  onClick={() => void runAction("setPlan", { action: "set_plan", planId: planOverride === "none" ? null : planOverride, planTestMode })}>
                  {actionBusy === "setPlan" ? <Loader2 className="size-3.5 animate-spin" /> : t("adminUserSavePlan")}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={planTestMode} onChange={(e) => setPlanTestMode(e.target.checked)} />
                {t("adminUsersTestMode")}
              </label>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="mt-0 space-y-4">
            <div className={`${adminPanelCardClass} space-y-3`}>
              <p className="text-sm font-medium text-foreground">{t("adminUserSetPasswordTitle")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("adminUserSetPasswordHint")}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="password"
                  value={actionPassword}
                  onChange={(e) => setActionPassword(e.target.value)}
                  placeholder={t("adminUserNewPassword")}
                  className="bg-background flex-1"
                  minLength={6}
                  disabled={!canSetPassword || actionBusy !== null}
                />
                <Button
                  type="button"
                  size="sm"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90 shrink-0 gap-1.5"
                  disabled={!canSetPassword || actionBusy !== null || actionPassword.trim().length < 6}
                  onClick={() => void setPassword()}
                >
                  {actionBusy === "setPassword" ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                  {t("adminUserSetPassword")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.email || actionBusy !== null}
                onClick={() => void runAction("passwordReset", { action: "send_password_reset" })}>
                {actionBusy === "passwordReset" ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                {t("adminUserPasswordReset")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={!user.email || user.emailVerified || actionBusy !== null}
                onClick={() => void runAction("verify", { action: "resend_verification" })}>
                {actionBusy === "verify" ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                {t("adminUserResendVerify")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} disabled={actionBusy !== null}
                onClick={() => void runAction(user.disabled ? "enable" : "disable", { action: user.disabled ? "enable_user" : "disable_user" }, user.disabled ? undefined : t("adminUserConfirmDisable"))}>
                {actionBusy === "disable" || actionBusy === "enable" ? <Loader2 className="size-3.5 animate-spin" /> : user.disabled ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
                {user.disabled ? t("adminUserEnable") : t("adminUserDisable")}
              </Button>
              <Button type="button" variant="destructive" size="sm" className="font-display gap-1" disabled={actionBusy !== null}
                onClick={() => void runAction("delete", { action: "delete_user" }, t("adminUserConfirmDelete"))}>
                {actionBusy === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {t("adminUserDelete")}
              </Button>
            </div>

            {linkResult ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{t("adminUserLinkGenerated")}</p>
                <Input readOnly value={linkResult} className="text-xs font-mono bg-background" onFocus={(e) => e.target.select()} />
                <Button type="button" size="sm" variant="outline" className={adminOutlineBtnClass}
                  onClick={() => { void navigator.clipboard.writeText(linkResult); toast.success(t("adminUserLinkCopied")); }}>
                  {t("adminUserCopyLink")}
                </Button>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="invoices" className="mt-0 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{t("adminUserInvoicesHint")}</p>
            {!user.stripeCustomerId ? (
              <div className={`${adminPanelCardClass} text-sm text-muted-foreground`}>{t("adminUserNoStripeCustomer")}</div>
            ) : user.stripeInvoices.length === 0 ? (
              <div className={`${adminPanelCardClass} text-sm text-muted-foreground`}>{t("adminUserNoInvoices")}</div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {user.stripeInvoices.map((inv) => (
                  <div key={inv.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="font-mono text-sm text-foreground truncate">{inv.id}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(inv.created)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-medium text-foreground">{formatMoney(inv.amountPaid, inv.currency)}</div>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium mt-1 ${subscriptionStatusClass(inv.status === "paid" ? "active" : inv.status)}`}>
                          {inv.status}
                        </span>
                      </div>
                      {inv.hostedInvoiceUrl ? (
                        <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} asChild>
                          <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3.5" />
                            {t("adminUserViewInvoice")}
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
