import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  listAdminUsers,
  runAdminUserAction,
  type AdminUserSummary,
} from "@/lib/adminUsersClient";
import { AdminUserDetailPanel } from "./AdminUserDetailPanel";
import { AdminCreateUserDialog } from "./AdminCreateUserDialog";
import { subscriptionStatusClass } from "./adminUserUi";
import { isPersonalPlan, parsePaystackPlanId } from "@shared/planCatalog";
import { isMultiLoginMode } from "@shared/loginMode";
import { toast } from "sonner";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

type ProductTab = "platform" | "personal";

type ConfirmKind = "admin_one" | "admin_bulk" | "delete_bulk" | "archive_bulk" | null;

/** Live Stripe only — test-mode / admin simulated plans are not billable. */
function hasLiveStripeSubscription(user: AdminUserSummary): boolean {
  if (user.disabled) return false;
  if (user.planTestMode || user.appAdmin) return false;
  const st = (user.subscriptionStatus || "").toLowerCase();
  return st === "active" || st === "trialing" || st === "past_due";
}

function sortUsersForAdmin(a: AdminUserSummary, b: AdminUserSummary): number {
  const aLive = hasLiveStripeSubscription(a) ? 0 : 1;
  const bLive = hasLiveStripeSubscription(b) ? 0 : 1;
  if (aLive !== bLive) return aLive - bLive;
  const aActive = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
  const bActive = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
  if (aActive !== bActive) return bActive - aActive;
  if (a.appAdmin !== b.appAdmin) return a.appAdmin ? -1 : 1;
  return (a.email || a.uid).localeCompare(b.email || b.uid);
}

function exportUsageCsv(users: AdminUserSummary[], filename: string): void {
  const header = [
    "uid",
    "email",
    "loginMode",
    "betaCohort",
    "lastActiveAt",
    "lastSignInAt",
    "logins30d",
    "sessionMinutes30d",
    "errors30d",
    "uploads30d",
    "docsThisMonth",
    "googleDriveConnected",
  ];
  const rows = users.map((u) =>
    [
      u.uid,
      u.email ?? "",
      u.loginMode ?? "",
      u.betaCohort ?? "",
      u.lastActiveAt ?? "",
      u.lastSignInAt ?? "",
      u.logins30d ?? "",
      u.sessionMinutes30d ?? "",
      u.errors30d ?? "",
      u.uploads30d ?? "",
      u.usageThisMonth ?? "",
      u.googleDriveConnected ? "yes" : "no",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isPersonalUser(user: AdminUserSummary): boolean {
  return isPersonalPlan(parsePaystackPlanId(user.planId));
}

function loginModeAdminLabel(
  mode: AdminUserSummary["loginMode"],
  t: (key: string) => string
): string {
  if (!mode) return "—";
  return isMultiLoginMode(mode) ? t("adminLoginModeShared") : t("adminLoginModeExclusive");
}

export function AdminUsersPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [productTab, setProductTab] = useState<ProductTab>("platform");
  const [adminBusyUid, setAdminBusyUid] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [pendingAdminUser, setPendingAdminUser] = useState<AdminUserSummary | null>(null);

  const loadUsers = useCallback(async (term?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers(term);
      setUsers(result.users);
    } catch (e) {
      setUsers([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const onSearch = () => void loadUsers(search);

  const openUser = (uid: string) => {
    setSelectedUid(uid);
  };

  const { subscribedUsers, noSubUsers, tabUsers, tabCount } = useMemo(() => {
    const filtered = users.filter((u) =>
      productTab === "personal" ? isPersonalUser(u) : !isPersonalUser(u)
    );
    const sorted = [...filtered].sort(sortUsersForAdmin);
    const subscribed = sorted.filter(hasLiveStripeSubscription);
    const noSub = sorted.filter((u) => !hasLiveStripeSubscription(u));
    return {
      subscribedUsers: subscribed,
      noSubUsers: noSub,
      tabUsers: sorted,
      tabCount: filtered.length,
    };
  }, [users, productTab]);

  const allTabSelected = tabUsers.length > 0 && tabUsers.every((u) => selected.has(u.uid));
  const selectedUsers = useMemo(
    () => tabUsers.filter((u) => selected.has(u.uid)),
    [tabUsers, selected]
  );

  const toggleSelect = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(tabUsers.map((u) => u.uid)));
  };

  const selectNoSubscription = () => {
    setSelected(new Set(noSubUsers.map((u) => u.uid)));
  };

  const clearSelection = () => setSelected(new Set());

  const applyAppAdmin = async (user: AdminUserSummary, enabled: boolean) => {
    setAdminBusyUid(user.uid);
    setError(null);
    try {
      const res = await runAdminUserAction(user.uid, { action: "set_app_admin", enabled });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                appAdmin: enabled,
                ...(enabled
                  ? {
                      subscriptionStatus: "none",
                      subscriptionId: null,
                    }
                  : {}),
              }
            : u
        )
      );
      toast.success(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdminBusyUid(null);
    }
  };

  const requestMakeAdmin = (user: AdminUserSummary) => {
    if (user.appAdmin) {
      void applyAppAdmin(user, false);
      return;
    }
    setPendingAdminUser(user);
    setConfirmKind("admin_one");
  };

  const runBulk = async (kind: "admin" | "archive" | "delete") => {
    if (selectedUsers.length === 0) return;
    setBulkBusy(true);
    setError(null);
    let ok = 0;
    let fail = 0;
    for (const user of selectedUsers) {
      try {
        if (kind === "admin") {
          await runAdminUserAction(user.uid, { action: "set_app_admin", enabled: true });
          setUsers((prev) =>
            prev.map((u) =>
              u.uid === user.uid
                ? { ...u, appAdmin: true, subscriptionStatus: "none", subscriptionId: null }
                : u
            )
          );
        } else if (kind === "archive") {
          await runAdminUserAction(user.uid, { action: "disable_user" });
          setUsers((prev) =>
            prev.map((u) =>
              u.uid === user.uid
                ? { ...u, disabled: true, subscriptionStatus: "none", subscriptionId: null }
                : u
            )
          );
        } else {
          await runAdminUserAction(user.uid, { action: "delete_user" });
          setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        }
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkBusy(false);
    clearSelection();
    if (fail === 0) {
      toast.success(
        kind === "admin"
          ? t("adminUsersBulkAdminDone").replace("{n}", String(ok))
          : kind === "archive"
            ? t("adminUsersBulkArchiveDone").replace("{n}", String(ok))
            : t("adminUsersBulkDeleteDone").replace("{n}", String(ok))
      );
    } else {
      setError(t("adminUsersBulkPartial").replace("{ok}", String(ok)).replace("{fail}", String(fail)));
    }
  };

  const onConfirm = () => {
    const kind = confirmKind;
    setConfirmKind(null);
    if (kind === "admin_one" && pendingAdminUser) {
      const u = pendingAdminUser;
      setPendingAdminUser(null);
      void applyAppAdmin(u, true);
      return;
    }
    setPendingAdminUser(null);
    if (kind === "admin_bulk") void runBulk("admin");
    if (kind === "archive_bulk") void runBulk("archive");
    if (kind === "delete_bulk") void runBulk("delete");
  };

  if (selectedUid) {
    return (
      <AdminUserDetailPanel
        uid={selectedUid}
        onBack={() => setSelectedUid(null)}
        onUserUpdated={() => void loadUsers(search)}
      />
    );
  }

  const confirmTitle =
    confirmKind === "admin_one" || confirmKind === "admin_bulk"
      ? t("adminUsersConfirmAdminTitle")
      : confirmKind === "delete_bulk"
        ? t("adminUsersConfirmDeleteTitle")
        : confirmKind === "archive_bulk"
          ? t("adminUsersConfirmArchiveTitle")
          : "";

  const confirmBody =
    confirmKind === "admin_one"
      ? t("adminUsersConfirmAdminBody").replace("{email}", pendingAdminUser?.email ?? pendingAdminUser?.uid ?? "")
      : confirmKind === "admin_bulk"
        ? t("adminUsersConfirmAdminBulkBody").replace("{n}", String(selectedUsers.length))
        : confirmKind === "delete_bulk"
          ? t("adminUsersConfirmDeleteBody").replace("{n}", String(selectedUsers.length))
          : confirmKind === "archive_bulk"
            ? t("adminUsersConfirmArchiveBody").replace("{n}", String(selectedUsers.length))
            : "";

  const adminToggle = (user: AdminUserSummary) => (
    <label
      className="inline-flex items-center gap-2 cursor-pointer select-none"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="size-4 rounded border-border accent-[var(--brand-red,#c41e3a)]"
        checked={user.appAdmin === true}
        disabled={adminBusyUid === user.uid || bulkBusy}
        onChange={() => requestMakeAdmin(user)}
        aria-label={t("adminUsersMakeAdmin")}
      />
      <span className="text-[11px] font-display font-semibold uppercase tracking-wide text-muted-foreground hidden sm:inline">
        {user.appAdmin ? t("adminUsersIsAdmin") : t("adminUsersMakeAdmin")}
      </span>
      {adminBusyUid === user.uid ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      {user.appAdmin ? <Shield className="size-3.5 text-brand-red sm:hidden" /> : null}
    </label>
  );

  const selectCell = (user: AdminUserSummary) => (
    <input
      type="checkbox"
      className="size-4 rounded border-border"
      checked={selected.has(user.uid)}
      disabled={bulkBusy}
      onClick={(e) => e.stopPropagation()}
      onChange={() => toggleSelect(user.uid)}
      aria-label={t("adminUsersSelectRow")}
    />
  );

  const renderUserCard = (user: AdminUserSummary) => (
    <div
      key={user.uid}
      className="w-full text-left p-4 space-y-2.5 transition-colors touch-manipulation border-b last:border-0"
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">{selectCell(user)}</div>
        <button type="button" className="flex-1 min-w-0 text-left active:bg-muted/40 rounded-md -m-1 p-1" onClick={() => openUser(user.uid)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground break-all">{user.email ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1 break-all line-clamp-1">{user.uid}</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {user.planId ? (
              <span className="font-display text-[10px] font-bold uppercase text-muted-foreground">{user.planId}</span>
            ) : null}
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${subscriptionStatusClass(user.subscriptionStatus)}`}
            >
              {user.subscriptionStatus ?? "none"}
            </span>
            {user.disabled ? (
              <Badge variant="destructive" className="text-[10px]">
                {t("adminUsersDisabled")}
              </Badge>
            ) : null}
            {user.planTestMode ? (
              <Badge variant="outline" className="text-[10px]">
                {t("adminUsersTestMode")}
              </Badge>
            ) : null}
            {user.appAdmin ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("adminUsersIsAdmin")}
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {t("adminUsersColLastActive")}: {formatDate(user.lastActiveAt ?? user.lastSignInAt)}
            {user.logins30d != null ? ` · ${user.logins30d} logins (30d)` : ""}
            {user.usageThisMonth != null ? ` · ${user.usageThisMonth} docs/mo` : ""}
            {user.uploads30d != null ? ` · ${user.uploads30d} uploads` : ""}
            {user.errors30d != null && user.errors30d > 0 ? ` · ${user.errors30d} errors` : ""}
            {user.betaCohort ? ` · ${user.betaCohort}` : ""}
            {user.loginMode ? ` · ${loginModeAdminLabel(user.loginMode, t)}` : ""}
          </p>
        </button>
      </div>
      <div className="pt-1 border-t border-border/60 pl-7">{adminToggle(user)}</div>
    </div>
  );

  const renderUserRow = (user: AdminUserSummary) => (
    <tr
      key={user.uid}
      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
      onClick={() => openUser(user.uid)}
    >
      <td className="py-3.5 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
        {selectCell(user)}
      </td>
      <td className="py-3.5 px-4">
        <div className="font-medium text-foreground">{user.email ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[280px]" title={user.uid}>
          {user.uid}
        </div>
      </td>
      <td className="py-3.5 px-4 align-top">
        <div className="flex flex-col gap-1">
          {user.planId ? (
            <span className="font-display text-xs font-bold uppercase">{user.planId}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {user.planTestMode ? (
            <Badge variant="outline" className="w-fit text-[10px]">
              {t("adminUsersTestMode")}
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="py-3.5 px-4 align-top">
        <div className="flex flex-wrap gap-1">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${subscriptionStatusClass(user.subscriptionStatus)}`}
          >
            {user.subscriptionStatus ?? "none"}
          </span>
          {user.disabled ? (
            <Badge variant="destructive">{t("adminUsersDisabled")}</Badge>
          ) : null}
        </div>
      </td>
      <td className="py-3.5 px-4 align-top" onClick={(e) => e.stopPropagation()}>
        {adminToggle(user)}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground">
        {user.emailVerified ? t("adminUsersYes") : t("adminUsersNo")}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground whitespace-nowrap">
        {formatDate(user.lastActiveAt ?? user.lastSignInAt)}
        {user.logins30d != null ? (
          <div className="text-[10px] text-muted-foreground/80">{user.logins30d} logins</div>
        ) : null}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground tabular-nums">
        {user.usageThisMonth ?? "—"}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground tabular-nums">
        {user.uploads30d ?? "—"}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground tabular-nums">
        {user.errors30d != null && user.errors30d > 0 ? (
          <span className="text-destructive font-medium">{user.errors30d}</span>
        ) : (
          (user.errors30d ?? "—")
        )}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground">
        {user.betaCohort ? (
          <Badge variant="outline" className="text-[10px] capitalize">
            {user.betaCohort}
          </Badge>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3.5 px-4 align-top text-muted-foreground text-xs">
        {loginModeAdminLabel(user.loginMode, t)}
      </td>
      <td className="py-3.5 px-4 align-top text-right">
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-brand-red transition-colors inline-block" />
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground">
            <Users className="size-5 text-brand-red shrink-0" />
            <h2 className="font-display text-xl font-bold">{t("adminUsersTitle")}</h2>
            {!loading ? (
              <Badge variant="secondary" className="font-display text-[10px]">
                {tabCount}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{t("adminUsersHint")}</p>
        </div>

        <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[360px]">
          <Button
            type="button"
            className="font-display bg-brand-red text-white hover:bg-brand-red/90 gap-1.5 w-full sm:w-auto min-h-11 touch-manipulation"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            {t("adminCreateUserTitle")}
          </Button>
          <div className="flex gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder={t("adminUsersSearchPlaceholder")}
                className="pl-10 font-editorial min-h-11"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onSearch}
              disabled={loading}
              className="shrink-0 font-display min-h-11 px-4 touch-manipulation"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("adminUsersSearch")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 min-h-11 min-w-11 touch-manipulation"
              onClick={() => {
                exportUsageCsv(tabUsers, `paystack-usage-${productTab}.csv`);
                toast.success(t("adminUserExportCsvDone"));
              }}
              disabled={loading || tabUsers.length === 0}
              aria-label={t("adminUserExportCsv")}
              title={t("adminUserExportCsv")}
            >
              <Download className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 min-h-11 min-w-11 touch-manipulation"
              onClick={() => void loadUsers(search)}
              disabled={loading}
              aria-label={t("adminUserRefresh")}
              title={t("adminUserRefresh")}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant={productTab === "platform" ? "default" : "outline"}
          className={`font-display text-xs min-h-10 ${productTab === "platform" ? "bg-brand-red text-white hover:bg-brand-red/90" : ""}`}
          onClick={() => {
            setProductTab("platform");
            clearSelection();
          }}
        >
          {t("adminUsersTabPlatform")}
        </Button>
        <Button
          type="button"
          variant={productTab === "personal" ? "default" : "outline"}
          className={`font-display text-xs min-h-10 ${productTab === "personal" ? "bg-brand-red text-white hover:bg-brand-red/90" : ""}`}
          onClick={() => {
            setProductTab("personal");
            clearSelection();
          }}
        >
          {t("adminUsersTabPersonal")}
        </Button>
      </div>

      {tabCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-display text-xs"
            onClick={() => (allTabSelected ? clearSelection() : selectAllVisible())}
            disabled={bulkBusy}
          >
            {allTabSelected ? t("adminUsersDeselectAll") : t("adminUsersSelectAll")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="font-display text-xs" onClick={selectNoSubscription} disabled={bulkBusy || noSubUsers.length === 0}>
            {t("adminUsersSelectNoSub")} ({noSubUsers.length})
          </Button>
          {selected.size > 0 ? (
            <>
              <Badge variant="secondary" className="font-display text-[10px]">
                {selectedUsers.length} {t("adminUsersSelected")}
              </Badge>
              <Button
                type="button"
                size="sm"
                className="font-display text-xs bg-brand-red text-white hover:bg-brand-red/90 gap-1"
                disabled={bulkBusy}
                onClick={() => setConfirmKind("admin_bulk")}
              >
                <Shield className="size-3.5" />
                {t("adminUsersBulkMakeAdmin")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-display text-xs gap-1"
                disabled={bulkBusy}
                onClick={() => setConfirmKind("archive_bulk")}
              >
                <Archive className="size-3.5" />
                {t("adminUsersBulkArchive")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="font-display text-xs gap-1"
                disabled={bulkBusy}
                onClick={() => setConfirmKind("delete_bulk")}
              >
                <Trash2 className="size-3.5" />
                {t("adminUsersBulkDelete")}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="font-display text-xs" disabled={bulkBusy} onClick={clearSelection}>
                {t("adminUsersClearSelection")}
              </Button>
              {bulkBusy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive font-medium rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          {t("authErrorPrefix")}
          {error}
        </p>
      ) : null}

      {loading && users.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground rounded-xl border border-border bg-card">
          <Loader2 className="size-6 animate-spin mx-auto mb-2" />
          {t("adminUsersLoading")}
        </div>
      ) : error && users.length === 0 ? null : tabCount === 0 ? (
        <div className="py-16 text-center text-muted-foreground rounded-xl border border-border bg-card px-4">
          {t("adminUsersEmpty")}
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-4">
            {subscribedUsers.length > 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <p className="px-4 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                  {t("adminUsersSectionActive")} ({subscribedUsers.length})
                </p>
                {subscribedUsers.map(renderUserCard)}
              </div>
            ) : null}
            {noSubUsers.length > 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <p className="px-4 py-2 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                  {t("adminUsersSectionInactive")} ({noSubUsers.length})
                </p>
                {noSubUsers.map(renderUserCard)}
              </div>
            ) : null}
          </div>

          <div className="hidden md:block space-y-4">
            {[
              { title: t("adminUsersSectionActive"), rows: subscribedUsers },
              { title: t("adminUsersSectionInactive"), rows: noSubUsers },
            ].map((section) =>
              section.rows.length === 0 ? null : (
                <div key={section.title} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <p className="px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
                    {section.title} ({section.rows.length})
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1120px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="py-3.5 px-3 w-10">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-border"
                              checked={allTabSelected}
                              onChange={() => (allTabSelected ? clearSelection() : selectAllVisible())}
                              aria-label={t("adminUsersSelectAll")}
                            />
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground min-w-[200px]">
                            {t("adminUsersColEmail")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-28">
                            {t("adminUsersColPlan")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-32">
                            {t("adminUsersColStatus")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-36">
                            {t("adminUsersColAdmin")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-24">
                            {t("adminUsersColVerified")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-36">
                            {t("adminUsersColLastActive")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-20">
                            {t("adminUsersColDocsMonth")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-20">
                            {t("adminUsersColUploads30d")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-20">
                            {t("adminUsersColErrors30d")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-24">
                            {t("adminUsersColCohort")}
                          </th>
                          <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-28">
                            {t("adminUsersColLoginMode")}
                          </th>
                          <th className="py-3.5 px-4 w-12" aria-hidden />
                        </tr>
                      </thead>
                      <tbody>{section.rows.map(renderUserRow)}</tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      <AdminCreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(uid) => {
          void loadUsers(search);
          setSelectedUid(uid);
        }}
      />

      <AlertDialog
        open={confirmKind != null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmKind(null);
            setPendingAdminUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminUsersConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmKind === "delete_bulk"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-brand-red text-white hover:bg-brand-red/90"
              }
              onClick={onConfirm}
            >
              {t("adminUsersConfirmContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
