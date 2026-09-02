import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Tag,
  Trash2,
  Users,
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
  listAdminUserActivity,
  runAdminUserAction,
  type AdminActivityEvent,
  type AdminDocumentSnapshot,
  type AdminUserDetail,
} from "@/lib/adminUsersClient";
import { toast } from "sonner";
import type { PaystackPlanId } from "@shared/planCatalog";
import { isMultiLoginMode } from "@shared/loginMode";
import {
  adminOutlineBtnClass,
  adminPanelCardClass,
  subscriptionStatusClass,
  verifiedStatusClass,
} from "./adminUserUi";

type Props = {
  uid: string;
  onBack: () => void;
  onUserUpdated: () => void;
};

type DetailTab = "profile" | "activity" | "billing" | "actions" | "invoices";

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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right min-w-0 break-all">{children}</span>
    </div>
  );
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function activityTypeLabel(type: string, t: (k: string) => string): string {
  if (type === "login") return t("adminActivityTypeLogin");
  if (type === "logout") return t("adminActivityTypeLogout");
  if (type === "session_heartbeat") return t("adminActivityTypeHeartbeat");
  if (type === "doc_upload") return t("adminActivityTypeUpload");
  if (type === "doc_processed") return t("adminActivityTypeProcessed");
  if (type === "document_process_error") return t("adminActivityTypeError");
  return type;
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
  const [deepPdfInvoiceBeta, setDeepPdfInvoiceBeta] = useState(false);
  const [betaCohort, setBetaCohort] = useState<string>("none");
  const [linkResult, setLinkResult] = useState<string | null>(null);

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editDisabled, setEditDisabled] = useState(false);
  const [actionPassword, setActionPassword] = useState("");
  const [activityEvents, setActivityEvents] = useState<AdminActivityEvent[]>([]);
  const [activityDocuments, setActivityDocuments] = useState<AdminDocumentSnapshot[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityErrorsOnly, setActivityErrorsOnly] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setLinkResult(null);
    try {
      const detail = await getAdminUser(uid);
      setUser(detail);
      setPlanOverride((detail.planId as PaystackPlanId) ?? "none");
      setPlanTestMode(detail.planTestMode);
      setDeepPdfInvoiceBeta(detail.deepPdfInvoiceBeta === true);
      setBetaCohort(detail.betaCohort ?? "none");
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

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await listAdminUserActivity(uid, {
        limit: 100,
        errorsOnly: activityErrorsOnly,
      });
      setActivityEvents(data.events);
      setActivityDocuments(data.documents);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setActivityLoading(false);
    }
  }, [uid, activityErrorsOnly]);

  useEffect(() => {
    if (activeTab === "activity") void loadActivity();
  }, [activeTab, loadActivity]);

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

  const copyUid = () => {
    void navigator.clipboard.writeText(uid);
    toast.success(t("adminUserUidCopied"));
  };

  const isPasswordUser = user?.providerIds.includes("password");
  const canEditEmail = isPasswordUser || (user?.providerIds.length ?? 0) === 0;
  const canSetPassword = Boolean(user?.email);

  const detailTabs: { id: DetailTab; label: string }[] = [
    { id: "profile", label: t("adminUserTabProfile") },
    { id: "activity", label: t("adminUserTabActivity") },
    { id: "billing", label: t("adminUserTabBilling") },
    { id: "actions", label: t("adminUserTabActions") },
    { id: "invoices", label: t("adminUserTabInvoices") },
  ];

  const stripeDashboardUrl = user?.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${user.stripeCustomerId}`
    : null;

  return (
    <div className="space-y-5">
      {/* Sticky back bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${adminOutlineBtnClass} min-h-10 gap-2 font-semibold`}
            onClick={onBack}
            title={t("adminUserBackHint")}
          >
            <ArrowLeft className="size-4" />
            <Users className="size-3.5 opacity-70 hidden sm:inline" />
            {t("adminUserBackToList")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${adminOutlineBtnClass} min-h-10 shrink-0`}
            onClick={() => void loadUser()}
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("adminUserRefresh")}
          </Button>
        </div>
      </div>

      {loading || !user ? (
        <div className="flex items-center justify-center py-24 rounded-xl border border-border bg-card">
          <Loader2 className="size-8 animate-spin text-brand-red" />
        </div>
      ) : (
        <>
          {/* Identity header */}
          <div className={`${adminPanelCardClass} space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div
                className="size-12 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center font-display text-lg font-bold shrink-0"
                aria-hidden
              >
                {(user.displayName || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground truncate">
                    {user.displayName || user.email || uid}
                  </h2>
                  {user.displayName && user.email ? (
                    <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-1 rounded break-all">
                    {uid}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground"
                    onClick={copyUid}
                  >
                    <Copy className="size-3" />
                    {t("adminUserCopyUid")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-display font-semibold uppercase">
                    {user.planId ?? t("adminUserNoPlan")}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${subscriptionStatusClass(user.subscriptionStatus)}`}
                  >
                    {user.subscriptionStatus ?? "none"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${verifiedStatusClass(user.emailVerified)}`}
                  >
                    {user.emailVerified ? t("adminUsersYes") : t("adminUsersNo")} · {t("adminUsersColVerified")}
                  </span>
                  {user.disabled ? (
                    <span className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/15 text-destructive px-2 py-0.5 text-[11px] font-medium">
                      {t("adminUsersDisabled")}
                    </span>
                  ) : null}
                  {user.planTestMode ? (
                    <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[11px] font-medium">
                      {t("adminUsersTestMode")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)} className="gap-5">
            <TabsList className="w-full h-auto gap-1.5 bg-muted/60 p-1.5 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:w-auto">
              {detailTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="font-display data-[state=active]:bg-card data-[state=active]:text-foreground px-3 sm:px-4 py-2.5 min-h-11 text-xs sm:text-sm touch-manipulation gap-1.5"
                >
                  {tab.id === "activity" ? <Activity className="size-3.5 opacity-70" /> : null}
                  {tab.id === "actions" ? <Shield className="size-3.5 opacity-70" /> : null}
                  {tab.label}
                  {tab.id === "activity" && activityEvents.length > 0 ? (
                    <span className="ml-0.5 text-[10px] opacity-70">({activityEvents.length})</span>
                  ) : null}
                  {tab.id === "invoices" && user.stripeInvoices.length > 0 ? (
                    <span className="ml-0.5 text-[10px] opacity-70">({user.stripeInvoices.length})</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Profile ── */}
            <TabsContent value="profile" className="mt-0 space-y-4">
              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionActivity")}</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetaRow label={t("adminUserLastActive")}>
                    {formatDateTime(user.lastActiveAt ?? user.lastSignInAt)}
                  </MetaRow>
                  <MetaRow label={t("adminUsersColLastSignIn")}>
                    {formatDateTime(user.lastSignInAt)}
                  </MetaRow>
                  <MetaRow label={t("adminUserLogins30d")}>{user.logins30d ?? "—"}</MetaRow>
                  <MetaRow label={t("adminUserSessionHours30d")}>
                    {user.sessionMinutes30d != null
                      ? (user.sessionMinutes30d / 60).toFixed(1)
                      : "—"}
                  </MetaRow>
                  <MetaRow label={t("adminUserDocsThisMonth")}>
                    {user.usageThisMonth ?? "—"}
                  </MetaRow>
                  <MetaRow label={t("adminUserUploads30d")}>{user.uploads30d ?? "—"}</MetaRow>
                  <MetaRow label={t("adminUserErrors30d")}>{user.errors30d ?? "—"}</MetaRow>
                  <MetaRow label={t("adminUserDriveConnected")}>
                    {user.googleDriveConnected ? t("adminUsersYes") : t("adminUsersNo")}
                  </MetaRow>
                  <MetaRow label={t("adminUsersColLoginMode")}>
                    {user.loginMode
                      ? isMultiLoginMode(user.loginMode)
                        ? t("adminLoginModeShared")
                        : t("adminLoginModeExclusive")
                      : "—"}
                  </MetaRow>
                </div>
              </div>

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserBetaCohort")}</SectionTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={betaCohort}
                    onValueChange={(v) => setBetaCohort(v)}
                  >
                    <SelectTrigger className="flex-1 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border">
                      <SelectItem value="none">{t("adminUserBetaCohortNone")}</SelectItem>
                      <SelectItem value="glanville">{t("adminUserBetaCohortGlanville")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="font-display bg-brand-red text-white hover:bg-brand-red/90 shrink-0"
                    disabled={actionBusy !== null}
                    onClick={() =>
                      void runAction("betaCohort", {
                        action: "set_beta_cohort",
                        cohort: betaCohort === "none" ? null : betaCohort,
                      })
                    }
                  >
                    {actionBusy === "betaCohort" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      t("adminUserSavePlan")
                    )}
                  </Button>
                </div>
              </div>

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionSnapshot")}</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetaRow label={t("adminUserProviders")}>
                    {user.providerIds.join(", ") || "—"}
                  </MetaRow>
                  <MetaRow label={t("adminUsersColLastSignIn")}>
                    {formatDateTime(user.lastSignInAt)}
                  </MetaRow>
                  {user.usageThisMonth != null ? (
                    <MetaRow label={t("adminUserDocsThisMonth")}>{user.usageThisMonth}</MetaRow>
                  ) : null}
                </div>
              </div>

              <div className={`${adminPanelCardClass} space-y-4`}>
                <SectionTitle>{t("adminUserSectionEditProfile")}</SectionTitle>
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
                      placeholder="+41 78 757 59 93"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("adminUserPhoneHint")}
                    </p>
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
                <div className="flex flex-wrap gap-4 pt-1 border-t border-border">
                  <label className="flex items-center gap-2 text-sm cursor-pointer pt-3">
                    <input
                      type="checkbox"
                      checked={editEmailVerified}
                      onChange={(e) => setEditEmailVerified(e.target.checked)}
                    />
                    {t("adminUserMarkVerified")}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer pt-3">
                    <input
                      type="checkbox"
                      checked={editDisabled}
                      onChange={(e) => setEditDisabled(e.target.checked)}
                    />
                    {t("adminUserCreateDisabled")}
                  </label>
                </div>
                <Button
                  type="button"
                  className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2"
                  disabled={actionBusy !== null}
                  onClick={() => void saveProfile()}
                >
                  {actionBusy === "saveProfile" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {t("adminUserSaveProfile")}
                </Button>
              </div>
            </TabsContent>

            {/* ── Activity / logs ── */}
            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className={`${adminPanelCardClass} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle>{t("adminActivityLogTitle")}</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={activityErrorsOnly ? "default" : "outline"}
                      className={`font-display text-xs ${activityErrorsOnly ? "bg-brand-red text-white hover:bg-brand-red/90" : ""}`}
                      onClick={() => setActivityErrorsOnly((v) => !v)}
                    >
                      <AlertTriangle className="size-3.5 mr-1" />
                      {t("adminActivityErrorsOnly")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`${adminOutlineBtnClass} text-xs`}
                      disabled={activityLoading}
                      onClick={() => void loadActivity()}
                    >
                      <RefreshCw className={`size-3.5 ${activityLoading ? "animate-spin" : ""}`} />
                      {t("adminUserRefresh")}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("adminActivityPrivacyHint")}</p>
                {activityLoading && activityEvents.length === 0 ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="size-6 animate-spin text-brand-red" />
                  </div>
                ) : activityEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">{t("adminActivityEmpty")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColWhen")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColType")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColFile")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColPages")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColDuration")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColDetail")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityEvents.map((ev) => (
                          <tr key={ev.id} className="border-b last:border-0 align-top">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">
                              {formatDateTime(ev.at || null)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                                  ev.type === "document_process_error"
                                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                                    : ev.type === "doc_processed"
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                      : "border-border bg-muted/40"
                                }`}
                              >
                                {activityTypeLabel(ev.type, t)}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[180px]">
                              <span className="truncate block" title={ev.meta?.fileName || undefined}>
                                {ev.meta?.fileName || "—"}
                              </span>
                              {ev.meta?.fileSizeBytes != null ? (
                                <span className="text-[10px] text-muted-foreground">
                                  {formatBytes(ev.meta.fileSizeBytes)}
                                  {ev.meta.mimeType ? ` · ${ev.meta.mimeType}` : ""}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {ev.meta?.pageCount ?? "—"}
                              {ev.meta?.pdfPageSplit ? (
                                <span className="block text-[10px]">{t("adminActivityPageSplit")}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                              {formatDuration(ev.meta?.durationMs)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[240px]">
                              {ev.meta?.errorCode ? (
                                <span className="font-mono text-destructive">{ev.meta.errorCode}</span>
                              ) : null}
                              {ev.meta?.errorMessage ? (
                                <p className="mt-0.5 line-clamp-3" title={ev.meta.errorMessage}>
                                  {ev.meta.errorMessage}
                                </p>
                              ) : !ev.meta?.errorCode ? (
                                "—"
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    {t("adminActivityDocsTitle")}
                  </span>
                </SectionTitle>
                <p className="text-xs text-muted-foreground">{t("adminActivityDocsHint")}</p>
                {activityDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">{t("adminActivityDocsEmpty")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColFile")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminUsersColStatus")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColPages")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColWhen")}
                          </th>
                          <th className="px-3 py-2 font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("adminActivityColDetail")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityDocuments.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 align-top">
                            <td className="px-3 py-2 max-w-[200px]">
                              <span className="truncate block font-medium" title={d.fileName || undefined}>
                                {d.fileName || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">{d.id.slice(0, 10)}…</span>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] ${
                                  d.status === "error"
                                    ? "border-destructive/40 text-destructive"
                                    : "border-border"
                                }`}
                              >
                                {d.status || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {d.pageCount ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(d.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px]">
                              {d.errorCode ? <span className="font-mono">{d.errorCode}</span> : null}
                              {d.error ? (
                                <p className="line-clamp-2 mt-0.5" title={d.error}>
                                  {d.error}
                                </p>
                              ) : !d.errorCode ? (
                                "—"
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Billing ── */}
            <TabsContent value="billing" className="mt-0 space-y-4">
              <div className={`${adminPanelCardClass} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle>{t("adminUserSectionOverview")}</SectionTitle>
                  {stripeDashboardUrl ? (
                    <Button type="button" variant="outline" size="sm" className={adminOutlineBtnClass} asChild>
                      <a href={stripeDashboardUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5" />
                        {t("adminUserOpenStripe")}
                      </a>
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("adminUsersColPlan")}
                    </p>
                    <p className="font-display font-bold uppercase text-foreground">
                      {user.planId ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("adminUsersColStatus")}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${subscriptionStatusClass(user.subscriptionStatus)}`}
                    >
                      {user.subscriptionStatus ?? "none"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <MetaRow label={t("adminUserSubStart")}>
                    {formatDateTime(user.stripeSubscription?.startDate ?? user.createdAt)}
                  </MetaRow>
                  <MetaRow label={t("adminUserPeriodStart")}>
                    {formatDateTime(user.stripeSubscription?.currentPeriodStart ?? null)}
                  </MetaRow>
                  <MetaRow label={t("adminUserPeriodEnd")}>
                    {formatDateTime(
                      user.stripeSubscription?.currentPeriodEnd ?? user.currentPeriodEnd
                    )}
                  </MetaRow>
                  {(user.stripeSubscription?.trialEndsAt || user.trialEndsAt) ? (
                    <MetaRow label={t("adminUserTrialEnds")}>
                      {formatDateTime(user.stripeSubscription?.trialEndsAt ?? user.trialEndsAt)}
                    </MetaRow>
                  ) : null}
                  <MetaRow label={t("adminUserLastPayment")}>
                    {user.lastPaymentAt
                      ? formatDateTime(user.lastPaymentAt)
                      : t("adminUserPaymentNever")}
                  </MetaRow>
                  <div className="flex justify-between gap-3 text-sm items-center">
                    <span className="text-muted-foreground">{t("adminUserPaymentLate")}</span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        user.paymentLate
                          ? "border-destructive/40 bg-destructive/15 text-destructive"
                          : "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {user.paymentLate
                        ? t("adminUserPaymentLateYes")
                        : t("adminUserPaymentOnTime")}
                    </span>
                  </div>
                  {user.stripeSubscription?.cancelAtPeriodEnd ? (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      {t("adminUserCancelScheduled")}
                    </p>
                  ) : null}
                  {user.stripeSubscription?.couponId ? (
                    <MetaRow label={t("adminUserActiveCoupon")}>
                      <span className="font-mono text-xs">{user.stripeSubscription.couponId}</span>
                    </MetaRow>
                  ) : null}
                  {user.stripeCustomerId ? (
                    <p className="text-xs text-muted-foreground break-all pt-1">
                      Stripe: {user.stripeCustomerId}
                      {user.stripeCustomerMatchPending ? " (not saved yet)" : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              {user.stripeCustomerMatchPending || !user.stripeCustomerId ? (
                <div className={`${adminPanelCardClass} space-y-3`}>
                  <SectionTitle>{t("adminUserSectionStripeLink")}</SectionTitle>
                  {user.stripeCustomerMatchPending ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                      {t("adminUserStripeMatchPending")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t("adminUserNoStripeCustomer")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("adminUserLinkStripeHint")}
                  </p>
                  <Button
                    type="button"
                    className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2 w-full sm:w-auto min-h-11"
                    disabled={!user.email || actionBusy !== null}
                    onClick={() => void runAction("linkStripe", { action: "link_stripe_by_email" })}
                  >
                    {actionBusy === "linkStripe" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    {t("adminUserLinkStripe")}
                  </Button>
                </div>
              ) : null}

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionSubActions")}</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.email || actionBusy !== null}
                    onClick={() => void runAction("auditStripe", { action: "audit_stripe_billing" })}
                  >
                    {actionBusy === "auditStripe" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="size-3.5" />
                    )}
                    {t("adminUserAuditStripe")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.email || actionBusy !== null}
                    onClick={() =>
                      void runAction(
                        "stopStripe",
                        { action: "stop_stripe_billing" },
                        t("adminUserConfirmStopStripe")
                      )
                    }
                  >
                    {actionBusy === "stopStripe" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    {t("adminUserStopStripe")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={(!user.subscriptionId && !user.email && !user.stripeCustomerId) || actionBusy !== null}
                    onClick={() =>
                      void runAction(
                        "cancel",
                        { action: "cancel_subscription", atPeriodEnd: true },
                        t("adminUserConfirmCancel")
                      )
                    }
                  >
                    {actionBusy === "cancel" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    {t("adminUserCancelSub")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.subscriptionId || actionBusy !== null}
                    onClick={() =>
                      void runAction("reactivate", { action: "reactivate_subscription" })
                    }
                  >
                    {actionBusy === "reactivate" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    {t("adminUserReactivateSub")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.stripeCustomerId || actionBusy !== null}
                    onClick={() =>
                      void runAction(
                        "refund",
                        { action: "refund_last_payment" },
                        t("adminUserConfirmRefund")
                      )
                    }
                  >
                    {actionBusy === "refund" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CreditCard className="size-3.5" />
                    )}
                    {t("adminUserRefund")}
                  </Button>
                </div>
              </div>

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionCoupon")}</SectionTitle>
                <Label htmlFor="admin-coupon" className="font-display text-xs">
                  {t("adminUserCouponId")}
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="admin-coupon"
                    value={couponId}
                    onChange={(e) => setCouponId(e.target.value)}
                    placeholder="SUMMER25"
                    className="font-mono text-sm bg-background flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`${adminOutlineBtnClass} shrink-0`}
                    disabled={!user.subscriptionId || !couponId.trim() || actionBusy !== null}
                    onClick={() =>
                      void runAction("coupon", {
                        action: "apply_coupon",
                        couponId: couponId.trim(),
                      })
                    }
                  >
                    {actionBusy === "coupon" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Tag className="size-3.5" />
                    )}
                    {t("adminUserApplyCoupon")}
                  </Button>
                </div>
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

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionPlanOverride")}</SectionTitle>
                <div className="flex gap-2">
                  <Select
                    value={planOverride}
                    onValueChange={(v) => setPlanOverride(v as PaystackPlanId | "none")}
                  >
                    <SelectTrigger className="flex-1 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border">
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
                    className="font-display bg-brand-red text-white hover:bg-brand-red/90 shrink-0"
                    disabled={actionBusy !== null}
                    onClick={() =>
                      void runAction(
                        "setPlan",
                        {
                          action: "set_plan",
                          planId: planOverride === "none" ? null : planOverride,
                          planTestMode,
                        },
                        planTestMode ? t("adminUserConfirmTestMode") : undefined
                      )
                    }
                  >
                    {actionBusy === "setPlan" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      t("adminUserSavePlan")
                    )}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planTestMode}
                    onChange={(e) => setPlanTestMode(e.target.checked)}
                  />
                  {t("adminUsersTestMode")}
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={deepPdfInvoiceBeta}
                    disabled={actionBusy !== null}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setDeepPdfInvoiceBeta(enabled);
                      void runAction("deepPdfBeta", {
                        action: "set_deep_pdf_invoice_beta",
                        enabled,
                      });
                    }}
                  />
                  <span>
                    <span className="font-medium">{t("adminUsersDeepPdfBeta")}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {t("adminUsersDeepPdfBetaHelp")}
                    </span>
                  </span>
                </label>
              </div>
            </TabsContent>

            {/* ── Security ── */}
            <TabsContent value="actions" className="mt-0 space-y-4">
              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSectionAccess")}</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.email || actionBusy !== null}
                    onClick={() =>
                      void runAction("passwordReset", { action: "send_password_reset" })
                    }
                  >
                    {actionBusy === "passwordReset" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="size-3.5" />
                    )}
                    {t("adminUserPasswordReset")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
                    disabled={!user.email || user.emailVerified || actionBusy !== null}
                    onClick={() =>
                      void runAction("verify", { action: "resend_verification" })
                    }
                  >
                    {actionBusy === "verify" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Mail className="size-3.5" />
                    )}
                    {t("adminUserResendVerify")}
                  </Button>
                </div>
                {linkResult ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {t("adminUserLinkGenerated")}
                    </p>
                    <Input
                      readOnly
                      value={linkResult}
                      className="text-xs font-mono bg-background"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminOutlineBtnClass}
                      onClick={() => {
                        void navigator.clipboard.writeText(linkResult);
                        toast.success(t("adminUserLinkCopied"));
                      }}
                    >
                      {t("adminUserCopyLink")}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className={`${adminPanelCardClass} space-y-3`}>
                <SectionTitle>{t("adminUserSetPasswordTitle")}</SectionTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("adminUserSetPasswordHint")}
                </p>
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
                    disabled={
                      !canSetPassword ||
                      actionBusy !== null ||
                      actionPassword.trim().length < 6
                    }
                    onClick={() => void setPassword()}
                  >
                    {actionBusy === "setPassword" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="size-3.5" />
                    )}
                    {t("adminUserSetPassword")}
                  </Button>
                </div>
              </div>

              <div
                className={`${adminPanelCardClass} space-y-3 border-destructive/30 bg-destructive/[0.03]`}
              >
                <SectionTitle>{t("adminUserSectionDanger")}</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminOutlineBtnClass}
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
                      void runAction(
                        "delete",
                        { action: "delete_user" },
                        t("adminUserConfirmDelete")
                      )
                    }
                  >
                    {actionBusy === "delete" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {t("adminUserDelete")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Invoices ── */}
            <TabsContent value="invoices" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {t("adminUserInvoicesHint")}
              </p>
              {user.stripeCustomerMatchPending ? (
                <div className={`${adminPanelCardClass} space-y-3`}>
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    {t("adminUserStripeMatchPending")}
                  </p>
                  <Button
                    type="button"
                    className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2 w-full sm:w-auto min-h-11"
                    disabled={!user.email || actionBusy !== null}
                    onClick={() =>
                      void runAction("linkStripe", { action: "link_stripe_by_email" })
                    }
                  >
                    {actionBusy === "linkStripe" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    {t("adminUserLinkStripe")}
                  </Button>
                </div>
              ) : null}
              {!user.stripeCustomerId && !user.stripeCustomerMatchPending ? (
                <div className={`${adminPanelCardClass} space-y-3`}>
                  <p className="text-sm text-muted-foreground">
                    {t("adminUserNoStripeCustomer")}
                  </p>
                  <Button
                    type="button"
                    className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-2 w-full sm:w-auto min-h-11"
                    disabled={!user.email || actionBusy !== null}
                    onClick={() =>
                      void runAction("linkStripe", { action: "link_stripe_by_email" })
                    }
                  >
                    {actionBusy === "linkStripe" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CreditCard className="size-4" />
                    )}
                    {t("adminUserLinkStripe")}
                  </Button>
                </div>
              ) : user.stripeInvoices.length === 0 ? (
                <div className={`${adminPanelCardClass} text-sm text-muted-foreground`}>
                  {t("adminUserNoInvoices")}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                  {user.stripeInvoices.map((inv) => {
                    const viewUrl = inv.hostedInvoiceUrl || inv.invoicePdf;
                    return (
                      <div
                        key={inv.id}
                        className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium text-foreground truncate">
                            {inv.number ? `#${inv.number}` : inv.id}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate">
                            {inv.id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(inv.created)}
                          </div>
                          {inv.periodStart || inv.periodEnd ? (
                            <div className="text-[10px] text-muted-foreground">
                              {t("adminUserInvoicePeriod")}: {formatDateTime(inv.periodStart)} →{" "}
                              {formatDateTime(inv.periodEnd)}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-medium text-foreground">
                              {formatMoney(inv.amountPaid, inv.currency)}
                            </div>
                            {inv.amountDue > 0 && inv.amountDue !== inv.amountPaid ? (
                              <div className="text-[10px] text-muted-foreground">
                                {t("adminUserInvoiceDue")}:{" "}
                                {formatMoney(inv.amountDue, inv.currency)}
                              </div>
                            ) : null}
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium mt-1 ${subscriptionStatusClass(inv.status === "paid" ? "active" : inv.status)}`}
                            >
                              {inv.status ?? "—"}
                            </span>
                          </div>
                          {viewUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={adminOutlineBtnClass}
                              asChild
                            >
                              <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" />
                                {t("adminUserViewInvoice")}
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
