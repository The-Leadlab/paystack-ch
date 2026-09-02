import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { apiUrl } from "@/lib/apiBase";

type TeamListResponse = {
  isOwner: boolean;
  canManageTeam?: boolean;
  members: Array<{ uid: string; email: string; role: string; status: string }>;
  invites: Array<{ id: string; email: string; role: string; status: string }>;
  seats: { used: number; max: number | null };
  memberOf: { ownerUid: string; role: string; ownerEmail: string | null } | null;
};

export function TeamInvitePanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { entitlements } = useSubscription();
  const { isOwner, ownerEmail, role, canInvite, canManageTeam } = useWorkspace();
  const [data, setData] = useState<TeamListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "manager" | "accountant">("member");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const seatsMax = entitlements.maxTeamSeats;
  const starterLocked = seatsMax === 1;

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
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Request failed");
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
    void refresh();
  }, [refresh]);

  const sendInvite = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await callTeam({ action: "invite", email: email.trim(), role: inviteRole });
      setMsg(t("billingTeamInviteSent").replace("{email}", email.trim()));
      setEmail("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("billingTeamInviteError"));
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

  const roleLabel = (raw: string) => {
    const r = raw.toLowerCase();
    if (r === "manager") return t("billingTeamRoleManager");
    if (r === "accountant" || r === "viewer") return t("billingTeamRoleAccountant");
    if (r === "member" || r === "editor") return t("billingTeamRoleMember");
    return raw;
  };

  const manageTeam = canManageTeam || data?.canManageTeam === true;

  const seatsLabel =
    data?.seats.max == null
      ? t("billingTeamSeatsUnlimited").replace("{used}", String(data?.seats.used ?? 1))
      : t("billingTeamSeats")
          .replace("{used}", String(data?.seats.used ?? 1))
          .replace("{max}", String(data.seats.max));

  return (
    <section className="rounded-xl border border-cdlp-border bg-cdlp-dark/25 p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-black uppercase tracking-wider text-cdlp-muted flex items-center gap-2">
        <Users className="w-4 h-4 shrink-0 text-cdlp-gold/70" aria-hidden />
        {t("billingTeamTitle")}
      </h2>
      <p className="text-xs text-cdlp-muted leading-relaxed">{t("billingTeamBody")}</p>

      {!isOwner && ownerEmail ? (
        <p className="text-xs text-cdlp-gold/90 font-medium">
          {t("billingTeamMemberBanner")
            .replace("{owner}", ownerEmail)
            .replace("{role}", roleLabel(role))}
        </p>
      ) : null}

      {!isOwner ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void leave()}
          className="h-10 px-4 rounded-sm border border-cdlp-border text-cdlp-muted font-black text-[10px] uppercase tracking-wider hover:border-cdlp-gold/35 hover:text-white disabled:opacity-50"
        >
          {t("billingTeamLeaveCta")}
        </button>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-cdlp-muted text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> …
        </div>
      ) : null}

      {msg ? <p className="text-xs text-emerald-400 font-medium">{msg}</p> : null}
      {err ? <p className="text-xs text-red-400 font-medium">{err}</p> : null}

      {isOwner && starterLocked ? (
        <p className="text-xs text-amber-400/90">{t("billingTeamStarterLocked")}</p>
      ) : manageTeam && !isOwner && starterLocked ? (
        <p className="text-xs text-amber-400/90">{t("billingTeamStarterLocked")}</p>
      ) : null}

      {canInvite && !starterLocked ? (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[12rem]">
            <label className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-1 block">
              {t("billingTeamInviteEmail")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ba-verify-field w-full"
              placeholder="colleague@company.ch"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-cdlp-muted mb-1 block">
              {t("billingTeamRole")}
            </label>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "member" | "manager" | "accountant")
              }
              className="ba-verify-field"
            >
              <option value="member">{t("billingTeamRoleMember")}</option>
              <option value="manager">{t("billingTeamRoleManager")}</option>
              <option value="accountant">{t("billingTeamRoleAccountant")}</option>
            </select>
          </div>
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void sendInvite()}
            className="h-10 px-4 rounded-sm bg-cdlp-gold text-cdlp-black font-black text-[10px] uppercase tracking-wider hover:bg-cdlp-gold-light disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {t("billingTeamInviteCta")}
          </button>
        </div>
      ) : null}

      <p className="text-[10px] font-bold uppercase tracking-wider text-cdlp-muted">{seatsLabel}</p>

      <ul className="space-y-2 text-xs">
        {data?.members.length === 0 && (data?.invites.length ?? 0) === 0 && isOwner ? (
          <li className="text-cdlp-muted">{t("billingTeamEmpty")}</li>
        ) : null}
        {data?.members.map((m) => (
          <li
            key={m.uid}
            className="flex justify-between items-center gap-2 border border-cdlp-border rounded-md px-3 py-2"
          >
            <span className="ba-field-value font-medium">{m.email}</span>
            <span className="flex items-center gap-2">
              <span className="uppercase text-[10px] font-black text-cdlp-muted">
                {roleLabel(m.role)} · {t("billingTeamActive")}
              </span>
              {manageTeam ? (
                <button
                  type="button"
                  className="underline text-[10px] text-cdlp-muted hover:text-white"
                  disabled={busy}
                  onClick={() => void remove(m.uid)}
                >
                  {t("billingTeamRemove")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
        {manageTeam
          ? data?.invites.map((inv) => (
              <li
                key={inv.id}
                className="flex justify-between items-center gap-2 border border-dashed border-cdlp-border rounded-md px-3 py-2"
              >
                <span className="text-cdlp-muted">{inv.email}</span>
                <span className="flex items-center gap-2">
                  <span className="uppercase text-[10px] font-black text-amber-500/90">
                    {roleLabel(inv.role)} · {t("billingTeamPending")}
                  </span>
                  <button
                    type="button"
                    className="underline text-[10px] text-cdlp-muted hover:text-white"
                    disabled={busy}
                    onClick={() => void revoke(inv.id)}
                  >
                    {t("billingTeamRevoke")}
                  </button>
                </span>
              </li>
            ))
          : null}
      </ul>
    </section>
  );
}
