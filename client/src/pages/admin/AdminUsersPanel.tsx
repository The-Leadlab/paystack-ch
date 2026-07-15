import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Plus, RefreshCw, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/cafe/context/LanguageContext";
import {
  listAdminUsers,
  type AdminUserSummary,
} from "@/lib/adminUsersClient";
import { AdminUserDetailPanel } from "./AdminUserDetailPanel";
import { AdminCreateUserDialog } from "./AdminCreateUserDialog";
import { subscriptionStatusClass } from "./adminUserUi";

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

export function AdminUsersPanel() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadUsers = useCallback(async (term?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers(term);
      setUsers(result.users);
    } catch (e) {
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

  if (selectedUid) {
    return (
      <AdminUserDetailPanel
        uid={selectedUid}
        onBack={() => setSelectedUid(null)}
        onUserUpdated={() => void loadUsers(search)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground">
            <Users className="size-5 text-brand-red shrink-0" />
            <h2 className="font-display text-xl font-bold">{t("adminUsersTitle")}</h2>
            {!loading ? (
              <Badge variant="secondary" className="font-display text-[10px]">
                {users.length}
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
              onClick={() => void loadUsers(search)}
              disabled={loading}
              aria-label={t("adminUserRefresh")}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive font-medium rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          {t("authErrorPrefix")}
          {error}
        </p>
      ) : null}

      {/* Mobile: card list (no horizontal scroll) */}
      <div className="md:hidden rounded-xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
        {loading && users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin mx-auto mb-2" />
            {t("adminUsersLoading")}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground px-4">{t("adminUsersEmpty")}</div>
        ) : (
          users.map((user) => (
            <button
              key={user.uid}
              type="button"
              className="w-full text-left p-4 space-y-2.5 active:bg-muted/40 transition-colors touch-manipulation"
              onClick={() => openUser(user.uid)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground break-all">{user.email ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1 break-all line-clamp-1">{user.uid}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("adminUsersColLastSignIn")}: {formatDate(user.lastSignInAt)}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground min-w-[220px]">
                  {t("adminUsersColEmail")}
                </th>
                <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-28">
                  {t("adminUsersColPlan")}
                </th>
                <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-32">
                  {t("adminUsersColStatus")}
                </th>
                <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-24">
                  {t("adminUsersColVerified")}
                </th>
                <th className="py-3.5 px-4 text-left font-display text-[11px] uppercase tracking-wider text-muted-foreground w-36">
                  {t("adminUsersColLastSignIn")}
                </th>
                <th className="py-3.5 px-4 w-12" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                    {t("adminUsersLoading")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    {t("adminUsersEmpty")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.uid}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => openUser(user.uid)}
                  >
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
                    <td className="py-3.5 px-4 align-top text-muted-foreground">
                      {user.emailVerified ? t("adminUsersYes") : t("adminUsersNo")}
                    </td>
                    <td className="py-3.5 px-4 align-top text-muted-foreground whitespace-nowrap">
                      {formatDate(user.lastSignInAt)}
                    </td>
                    <td className="py-3.5 px-4 align-top text-right">
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-brand-red transition-colors inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminCreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(uid) => {
          void loadUsers(search);
          setSelectedUid(uid);
        }}
      />
    </div>
  );
}
