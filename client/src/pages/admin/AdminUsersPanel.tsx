import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/cafe/context/LanguageContext";
import {
  listAdminUsers,
  type AdminUserSummary,
} from "@/lib/adminUsersClient";
import { AdminUserDetailPanel } from "./AdminUserDetailPanel";

function statusBadgeVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!status || status === "none") return "outline";
  if (status === "active" || status === "trialing") return "default";
  if (status === "canceled" || status === "unpaid" || status === "past_due") return "destructive";
  return "secondary";
}

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
  const [detailOpen, setDetailOpen] = useState(false);

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
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="size-5 text-brand-red" />
          <h2 className="font-display text-lg font-bold">{t("adminUsersTitle")}</h2>
        </div>
        <div className="flex gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder={t("adminUsersSearchPlaceholder")}
              className="pl-9 font-editorial"
            />
          </div>
          <Button type="button" variant="outline" onClick={onSearch} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : t("adminUsersSearch")}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => void loadUsers(search)} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive font-medium">
          {t("authErrorPrefix")}
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-3 px-4 text-left font-display text-xs uppercase tracking-wider">{t("adminUsersColEmail")}</th>
                <th className="py-3 px-4 text-left font-display text-xs uppercase tracking-wider">{t("adminUsersColPlan")}</th>
                <th className="py-3 px-4 text-left font-display text-xs uppercase tracking-wider">{t("adminUsersColStatus")}</th>
                <th className="py-3 px-4 text-left font-display text-xs uppercase tracking-wider">{t("adminUsersColVerified")}</th>
                <th className="py-3 px-4 text-left font-display text-xs uppercase tracking-wider">{t("adminUsersColLastSignIn")}</th>
                <th className="py-3 px-4 text-right font-display text-xs uppercase tracking-wider">{t("adminUsersColActions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2" />
                    {t("adminUsersLoading")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {t("adminUsersEmpty")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.uid}
                    className="border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => openUser(user.uid)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium">{user.email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]">{user.uid}</div>
                    </td>
                    <td className="py-3 px-4">
                      {user.planId ? (
                        <span className="font-display text-xs font-bold uppercase">{user.planId}</span>
                      ) : (
                        "—"
                      )}
                      {user.planTestMode ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {t("adminUsersTestMode")}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusBadgeVariant(user.subscriptionStatus)}>
                        {user.subscriptionStatus ?? "none"}
                      </Badge>
                      {user.disabled ? (
                        <Badge variant="destructive" className="ml-1">
                          {t("adminUsersDisabled")}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      {user.emailVerified ? t("adminUsersYes") : t("adminUsersNo")}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{formatDate(user.lastSignInAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="font-display"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUser(user.uid);
                        }}
                      >
                        {t("adminUsersManage")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminUserDetailPanel
        uid={selectedUid}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUserUpdated={() => void loadUsers(search)}
      />
    </div>
  );
}
