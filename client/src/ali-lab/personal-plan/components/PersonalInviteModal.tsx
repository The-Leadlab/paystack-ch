import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/cafe/context/AuthContext";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { useSubscription } from "@/cafe/context/SubscriptionContext";
import { useWorkspace } from "@/cafe/context/WorkspaceContext";
import { apiUrl } from "@/lib/apiBase";
import { formatMoney, detectDisplayCurrency } from "@shared/displayCurrency";
import { PERSONAL_EXTRA_SEAT_CHF } from "@shared/planCatalog";
import { usePersonalPlan } from "../context/PersonalPlanContext";

type TeamListResponse = {
  isOwner: boolean;
  members: Array<{ uid: string; email: string; role: string; status: string }>;
  invites: Array<{ id: string; email: string; role: string; status: string }>;
  seats: { used: number; max: number | null };
  memberOf: { ownerUid: string; role: string; ownerEmail: string | null } | null;
};

type TeamApiError = Error & { code?: string };

/** Invite modal opened from the Personal sidebar — seat overage → CHF 5 add-on. */
export function PersonalInviteModal() {
  const { t } = useLanguage();
  const { inviteOpen, closeInvite } = usePersonalPlan();
  const { user } = useAuth();
  const { purchasePersonalAddon } = useSubscription();
  const { isOwner, ownerEmail, role } = useWorkspace();
  const [data, setData] = useState<TeamListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [needsSeat, setNeedsSeat] = useState(false);

  const seatPrice = formatMoney(PERSONAL_EXTRA_SEAT_CHF, detectDisplayCurrency());

  const callTeam = useCallback(
    async (body: Record<string, unknown>) => {
      if (!user) throw new Error("Not signed in");
      const token = await user.getIdToken();
      const res = await fetch(apiUrl("/api/team"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        const e = new Error(json.error || "Request failed") as TeamApiError;
        e.code = typeof json.code === "string" ? json.code : undefined;
        throw e;
      }
      return json;
    },
    [user]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const json = (await callTeam({ action: "list" })) as unknown as TeamListResponse;
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [callTeam]);

  useEffect(() => {
    if (!inviteOpen) return;
    setMsg(null);
    setErr(null);
    setNeedsSeat(false);
    void refresh();
  }, [inviteOpen, refresh]);

  const sendInvite = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    setNeedsSeat(false);
    try {
      await callTeam({ action: "invite", email: email.trim(), role: inviteRole });
      setMsg(t("billingTeamInviteSent").replace("{email}", email.trim()));
      setEmail("");
      await refresh();
    } catch (e) {
      const te = e as TeamApiError;
      if (te.code === "SEAT_LIMIT") {
        setNeedsSeat(true);
        setErr(t("personalInviteSeatLimit").replace("{price}", seatPrice));
      } else {
        setErr(te.message || t("billingTeamInviteError"));
      }
    } finally {
      setBusy(false);
    }
  };

  const buySeatThenInvite = async () => {
    const pendingEmail = email.trim();
    if (!pendingEmail) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const result = await purchasePersonalAddon("seat");
      setMsg(result.message);
      setNeedsSeat(false);
      await callTeam({ action: "invite", email: pendingEmail, role: inviteRole });
      setMsg(t("billingTeamInviteSent").replace("{email}", pendingEmail));
      setEmail("");
      await refresh();
    } catch (e) {
      const te = e as TeamApiError;
      if (te.code === "SEAT_LIMIT") {
        setNeedsSeat(true);
        setErr(t("personalInviteSeatLimit").replace("{price}", seatPrice));
      } else {
        setErr(e instanceof Error ? e.message : t("personalAddonError"));
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (inviteId: string) => {
    setBusy(true);
    try {
      await callTeam({ action: "revoke_invite", inviteId });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberUid: string) => {
    setBusy(true);
    try {
      await callTeam({ action: "remove_member", memberUid });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await callTeam({ action: "leave" });
      setMsg(t("billingTeamLeaveDone"));
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const seats = data?.seats;
  const atLimit =
    seats != null && seats.max != null && seats.used >= seats.max && seats.max > 0;

  return (
    <Dialog open={inviteOpen} onOpenChange={(open) => (!open ? closeInvite() : undefined)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t("personalInviteTitle")}
          </DialogTitle>
          <DialogDescription>{t("personalInviteBody")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {!isOwner && data?.memberOf ? (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs">
                {t("billingTeamMemberBanner")
                  .replace("{owner}", ownerEmail || data.memberOf.ownerEmail || "—")
                  .replace("{role}", role || data.memberOf.role)}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void leave()}
                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                {t("billingTeamLeaveCta")}
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              …
            </div>
          ) : isOwner ? (
            <>
              {seats ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {seats.max == null
                    ? t("billingTeamSeatsUnlimited").replace("{used}", String(seats.used))
                    : t("billingTeamSeats")
                        .replace("{used}", String(seats.used))
                        .replace("{max}", String(seats.max))}
                </p>
              ) : null}

              {msg ? <p className="text-xs text-emerald-600 font-medium">{msg}</p> : null}
              {err ? <p className="text-xs text-red-500 font-medium">{err}</p> : null}

              {(needsSeat || atLimit) && email.trim() ? (
                <button
                  type="button"
                  disabled={busy || !email.trim()}
                  onClick={() => void buySeatThenInvite()}
                  className="w-full h-10 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t("personalInvitePaySeatCta").replace("{price}", seatPrice)}
                </button>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setNeedsSeat(false);
                  }}
                  placeholder={t("billingTeamInviteEmail")}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                  className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                  aria-label={t("billingTeamRole")}
                >
                  <option value="editor">{t("billingTeamRoleEditor")}</option>
                  <option value="viewer">{t("billingTeamRoleViewer")}</option>
                </select>
                <button
                  type="button"
                  disabled={busy || !email.trim()}
                  onClick={() => void sendInvite()}
                  className="h-10 px-4 rounded-md bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {t("personalInviteCta")}
                </button>
              </div>

              {data && data.invites.length === 0 && data.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("personalInviteEmpty")}</p>
              ) : null}

              {data?.invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 text-xs border-t border-border pt-3"
                >
                  <span className="truncate">
                    {inv.email} · {t("billingTeamPending")} · {inv.role}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revoke(inv.id)}
                    className="text-red-600 font-semibold hover:underline disabled:opacity-50 shrink-0"
                  >
                    {t("billingTeamRevoke")}
                  </button>
                </div>
              ))}

              {data?.members.map((m) => (
                <div
                  key={m.uid}
                  className="flex items-center justify-between gap-2 text-xs border-t border-border pt-3"
                >
                  <span className="truncate">
                    {m.email} · {t("billingTeamActive")} · {m.role}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(m.uid)}
                    className="text-red-600 font-semibold hover:underline disabled:opacity-50 shrink-0"
                  >
                    {t("billingTeamRemove")}
                  </button>
                </div>
              ))}
            </>
          ) : !data?.memberOf ? (
            <p className="text-xs text-muted-foreground">{t("personalInviteOwnerOnly")}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
