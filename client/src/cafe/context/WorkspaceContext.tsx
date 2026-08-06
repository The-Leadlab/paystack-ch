/**
 * Resolves which Firebase uid owns the financial data the signed-in user should see.
 * Owners use their own uid; invited members use the workspace owner's uid (restaurantId).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { apiUrl } from "@/lib/apiBase";

export type WorkspaceRole = "owner" | "editor" | "viewer";

type WorkspaceContextValue = {
  loading: boolean;
  /** Auth user uid */
  authUid: string | null;
  /** restaurantId / data scope — owner uid for members */
  dataOwnerUid: string | null;
  role: WorkspaceRole;
  isOwner: boolean;
  canWrite: boolean;
  ownerEmail: string | null;
  refresh: () => Promise<void>;
  acceptInviteToken: (token: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole>("owner");
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setOwnerUid(null);
      setRole("owner");
      setOwnerEmail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "workspaceMembers", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists() && snap.data()?.status === "active" && typeof snap.data()?.ownerUid === "string") {
          setOwnerUid(snap.data()!.ownerUid as string);
          const r = snap.data()!.role;
          setRole(r === "viewer" || r === "editor" ? r : "editor");
          setOwnerEmail(typeof snap.data()!.ownerEmail === "string" ? (snap.data()!.ownerEmail as string) : null);
        } else {
          setOwnerUid(user.uid);
          setRole("owner");
          setOwnerEmail(user.email ?? null);
        }
        setLoading(false);
      },
      (err) => {
        // Missing membership doc used to fail rules when resource.data was evaluated.
        // Fall back to owner scope; avoid noisy console for expected permission-denied.
        if (import.meta.env.DEV) {
          console.warn("Workspace membership snapshot:", err);
        }
        setOwnerUid(user.uid);
        setRole("owner");
        setOwnerEmail(user.email ?? null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const acceptInviteToken = useCallback(
    async (token: string) => {
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch(apiUrl("/api/team"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "accept", token }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not accept invite");
    },
    [user]
  );

  const refresh = useCallback(async () => {
    // Snapshot listener keeps state fresh; this is a no-op hook for callers.
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => {
    const authUid = user?.uid ?? null;
    const dataOwnerUid = ownerUid ?? authUid;
    const isOwner = Boolean(authUid && dataOwnerUid && authUid === dataOwnerUid);
    return {
      loading,
      authUid,
      dataOwnerUid,
      role: isOwner ? "owner" : role,
      isOwner,
      canWrite: isOwner || role === "editor",
      ownerEmail,
      refresh,
      acceptInviteToken,
    };
  }, [user?.uid, ownerUid, role, ownerEmail, loading, refresh, acceptInviteToken]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

/** Safe hook when provider may be absent (e.g. marketing pages). */
export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
