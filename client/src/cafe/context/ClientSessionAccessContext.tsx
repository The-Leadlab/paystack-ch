import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db } from "../lib/firebase";
import {
  getClientSessionRole,
  setClientSessionRole,
  getLocalClientSessionId,
  touchSharedPrimaryActivity,
  tryClaimIdleSharedPrimary,
  syncClientSessionRole,
} from "../lib/activeClientSession";
import { isMultiLoginMode, parseLoginMode, type LoginMode } from "@shared/loginMode";
import type { ClientSessionRole } from "../lib/activeClientSession";
import {
  createSessionAccessRequest,
  getContributorSessionId,
  setContributorSessionId,
  watchMySessionAccessRequest,
  watchPendingSessionAccessRequests,
  type SessionAccessRequest,
} from "../lib/sessionAccessRequests";
import {
  clearClientPresence,
  presenceNameForId,
  upsertClientPresence,
  watchClientPresence,
  type ClientPresence,
} from "../lib/clientPresence";

export type ClientAccessRole = ClientSessionRole | "contributor";

type ClientSessionAccessValue = {
  loginMode: LoginMode;
  role: ClientAccessRole;
  isViewOnly: boolean;
  canMutateData: boolean;
  grantedSessionId: string | null;
  pendingRequests: SessionAccessRequest[];
  myRequest: SessionAccessRequest | null;
  /** Live shared-login presence (self + peers). Empty when exclusive mode. */
  presence: ClientPresence[];
  requestUploadAccess: () => Promise<"claimed" | "requested">;
  setGrantedSession: (sessionId: string | null) => void;
};

const ClientSessionAccessContext = createContext<ClientSessionAccessValue | null>(null);

type Props = {
  children: React.ReactNode;
  currentSessionId?: string | null;
};

export function ClientSessionAccessProvider({ children, currentSessionId }: Props) {
  const { user } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>("exclusive");
  const [role, setRole] = useState<ClientAccessRole>(() => getClientSessionRole());
  const [grantedSessionId, setGrantedSessionIdState] = useState<string | null>(
    () => getContributorSessionId()
  );
  const [pendingRequests, setPendingRequests] = useState<SessionAccessRequest[]>([]);
  const [myRequest, setMyRequest] = useState<SessionAccessRequest | null>(null);
  const [presence, setPresence] = useState<ClientPresence[]>([]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setLoginMode(parseLoginMode(snap.data()?.loginMode));
    });
  }, [user?.uid]);

  useEffect(() => {
    setRole(getClientSessionRole());
    const stored = getContributorSessionId();
    if (stored) {
      setGrantedSessionIdState(stored);
    }
    if (!user?.uid) return;
    let cancelled = false;
    void syncClientSessionRole(user.uid).then((next) => {
      if (cancelled) return;
      setRole(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const storedRole = getClientSessionRole();
    if (storedRole === "primary") {
      return watchPendingSessionAccessRequests(user.uid, setPendingRequests);
    }
    return watchMySessionAccessRequest(user.uid, (req) => {
      setMyRequest(req);
      if (req?.status === "approved" && req.grantedSessionId) {
        setContributorSessionId(req.grantedSessionId);
        setGrantedSessionIdState(req.grantedSessionId);
        setClientSessionRole("contributor");
        setRole("contributor");
      }
    });
  }, [user?.uid, role]);

  // Presence heartbeats + host keepalive for shared multi-login
  useEffect(() => {
    if (!user?.uid || !isMultiLoginMode(loginMode)) {
      setPresence([]);
      return;
    }
    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      const currentRole = getClientSessionRole();
      void upsertClientPresence(user.uid, currentRole === "contributor" ? "contributor" : currentRole);
      if (currentRole === "primary") {
        void touchSharedPrimaryActivity(user.uid);
      }
    };
    beat();
    const interval = window.setInterval(beat, 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = watchClientPresence(user.uid, setPresence);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
      void clearClientPresence(user.uid);
    };
  }, [user?.uid, loginMode, role]);

  // Viewers periodically take over if the host has been idle ~15 minutes
  useEffect(() => {
    if (!user?.uid || !isMultiLoginMode(loginMode)) return;
    if (role === "primary") return;

    let cancelled = false;
    const attempt = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const next = await tryClaimIdleSharedPrimary(user.uid);
      if (cancelled) return;
      if (next === "primary") {
        setRole("primary");
        void upsertClientPresence(user.uid, "primary");
      }
    };

    void attempt();
    const interval = window.setInterval(() => void attempt(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.uid, loginMode, role]);

  const setGrantedSession = useCallback((sessionId: string | null) => {
    setContributorSessionId(sessionId);
    setGrantedSessionIdState(sessionId);
    if (sessionId) {
      setClientSessionRole("contributor");
      setRole("contributor");
    }
  }, []);

  const requestUploadAccess = useCallback(async (): Promise<"claimed" | "requested"> => {
    if (!user?.uid) return "requested";
    // If host is already idle, become host instead of asking nobody
    const next = await tryClaimIdleSharedPrimary(user.uid);
    if (next === "primary") {
      setRole("primary");
      void upsertClientPresence(user.uid, "primary");
      return "claimed";
    }
    const local = getLocalClientSessionId();
    const label = local ? presenceNameForId(local, "viewer") : undefined;
    await createSessionAccessRequest(user.uid, label);
    return "requested";
  }, [user?.uid]);

  const value = useMemo<ClientSessionAccessValue>(() => {
    const isViewOnly = role === "viewer";
    const contributorActive =
      role === "contributor" &&
      Boolean(grantedSessionId && currentSessionId && grantedSessionId === currentSessionId);
    const canMutateData = role === "primary" || contributorActive;
    return {
      loginMode,
      role,
      isViewOnly,
      canMutateData,
      grantedSessionId,
      pendingRequests,
      myRequest,
      presence: isMultiLoginMode(loginMode) ? presence : [],
      requestUploadAccess,
      setGrantedSession,
    };
  }, [
    loginMode,
    role,
    grantedSessionId,
    currentSessionId,
    pendingRequests,
    myRequest,
    presence,
    requestUploadAccess,
    setGrantedSession,
  ]);

  return (
    <ClientSessionAccessContext.Provider value={value}>{children}</ClientSessionAccessContext.Provider>
  );
}

export function useClientSessionAccess(): ClientSessionAccessValue {
  const ctx = useContext(ClientSessionAccessContext);
  if (!ctx) {
    return {
      loginMode: "exclusive",
      role: "primary",
      isViewOnly: false,
      canMutateData: true,
      grantedSessionId: null,
      pendingRequests: [],
      myRequest: null,
      presence: [],
      requestUploadAccess: async () => "requested" as const,
      setGrantedSession: () => undefined,
    };
  }
  return ctx;
}

export function isSharedLoginAccount(mode: LoginMode): boolean {
  return isMultiLoginMode(mode);
}
