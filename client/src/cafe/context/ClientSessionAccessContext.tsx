import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { getClientSessionRole, setClientSessionRole } from "../lib/activeClientSession";
import { DEFAULT_LOGIN_MODE, type LoginMode } from "@shared/loginMode";
import type { ClientSessionRole } from "../lib/activeClientSession";
import {
  createSessionAccessRequest,
  getContributorSessionId,
  setContributorSessionId,
  watchMySessionAccessRequest,
  watchPendingSessionAccessRequests,
  type SessionAccessRequest,
} from "../lib/sessionAccessRequests";

export type ClientAccessRole = ClientSessionRole | "contributor";

type ClientSessionAccessValue = {
  loginMode: LoginMode;
  role: ClientAccessRole;
  isViewOnly: boolean;
  canMutateData: boolean;
  grantedSessionId: string | null;
  pendingRequests: SessionAccessRequest[];
  myRequest: SessionAccessRequest | null;
  requestUploadAccess: () => Promise<void>;
  setGrantedSession: (sessionId: string | null) => void;
};

const ClientSessionAccessContext = createContext<ClientSessionAccessValue | null>(null);

type Props = {
  children: React.ReactNode;
  currentSessionId?: string | null;
};

export function ClientSessionAccessProvider({ children, currentSessionId }: Props) {
  const { user } = useAuth();
  const [role, setRole] = useState<ClientAccessRole>(() => getClientSessionRole());
  const [grantedSessionId, setGrantedSessionIdState] = useState<string | null>(
    () => getContributorSessionId()
  );
  const [pendingRequests, setPendingRequests] = useState<SessionAccessRequest[]>([]);
  const [myRequest, setMyRequest] = useState<SessionAccessRequest | null>(null);

  useEffect(() => {
    setRole(getClientSessionRole());
    const stored = getContributorSessionId();
    if (stored) {
      setGrantedSessionIdState(stored);
    }
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

  const setGrantedSession = useCallback((sessionId: string | null) => {
    setContributorSessionId(sessionId);
    setGrantedSessionIdState(sessionId);
    if (sessionId) {
      setClientSessionRole("contributor");
      setRole("contributor");
    }
  }, []);

  const requestUploadAccess = useCallback(async () => {
    if (!user?.uid) return;
    await createSessionAccessRequest(user.uid);
  }, [user?.uid]);

  const value = useMemo<ClientSessionAccessValue>(() => {
    const isViewOnly = role === "viewer";
    const contributorActive =
      role === "contributor" &&
      Boolean(grantedSessionId && currentSessionId && grantedSessionId === currentSessionId);
    const canMutateData = role === "primary" || contributorActive;
    return {
      loginMode: DEFAULT_LOGIN_MODE,
      role,
      isViewOnly,
      canMutateData,
      grantedSessionId,
      pendingRequests,
      myRequest,
      requestUploadAccess,
      setGrantedSession,
    };
  }, [
    role,
    grantedSessionId,
    currentSessionId,
    pendingRequests,
    myRequest,
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
      loginMode: DEFAULT_LOGIN_MODE,
      role: "primary",
      isViewOnly: false,
      canMutateData: true,
      grantedSessionId: null,
      pendingRequests: [],
      myRequest: null,
      requestUploadAccess: async () => undefined,
      setGrantedSession: () => undefined,
    };
  }
  return ctx;
}

export function isSharedLoginAccount(_mode?: LoginMode): boolean {
  return true;
}
