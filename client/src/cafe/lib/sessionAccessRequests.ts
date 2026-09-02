import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getLocalClientSessionId } from "./activeClientSession";

export type SessionAccessRequest = {
  id: string;
  requesterClientSessionId: string;
  requesterLabel: string | null;
  status: "pending" | "approved" | "denied";
  grantedSessionId: string | null;
  grantedSessionName: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

function requestsCol(uid: string) {
  if (!db) throw new Error("Firestore not configured");
  return collection(db, "users", uid, "sessionAccessRequests");
}

export async function createSessionAccessRequest(
  uid: string,
  label?: string
): Promise<string> {
  const requesterClientSessionId = getLocalClientSessionId();
  if (!requesterClientSessionId) throw new Error("No client session");
  const ref = await addDoc(requestsCol(uid), {
    requesterClientSessionId,
    requesterLabel: label?.trim() || null,
    status: "pending",
    grantedSessionId: null,
    grantedSessionName: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  return ref.id;
}

export async function resolveSessionAccessRequest(
  uid: string,
  requestId: string,
  status: "approved" | "denied",
  granted?: { sessionId: string; sessionName: string }
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "users", uid, "sessionAccessRequests", requestId), {
    status,
    grantedSessionId: granted?.sessionId ?? null,
    grantedSessionName: granted?.sessionName ?? null,
    resolvedAt: new Date().toISOString(),
  });
}

export function watchPendingSessionAccessRequests(
  uid: string,
  onChange: (requests: SessionAccessRequest[]) => void
): Unsubscribe {
  if (!db) {
    onChange([]);
    return () => undefined;
  }
  const q = query(requestsCol(uid), where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: SessionAccessRequest[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          requesterClientSessionId: String(data.requesterClientSessionId || ""),
          requesterLabel: typeof data.requesterLabel === "string" ? data.requesterLabel : null,
          status: data.status === "approved" || data.status === "denied" ? data.status : "pending",
          grantedSessionId:
            typeof data.grantedSessionId === "string" ? data.grantedSessionId : null,
          grantedSessionName:
            typeof data.grantedSessionName === "string" ? data.grantedSessionName : null,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
          resolvedAt: typeof data.resolvedAt === "string" ? data.resolvedAt : null,
        };
      });
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onChange(rows);
    },
    () => onChange([])
  );
}

export function watchMySessionAccessRequest(
  uid: string,
  onUpdate: (request: SessionAccessRequest | null) => void
): Unsubscribe {
  const local = getLocalClientSessionId();
  if (!db || !local) {
    onUpdate(null);
    return () => undefined;
  }
  const q = query(requestsCol(uid), where("requesterClientSessionId", "==", local));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            requesterClientSessionId: String(data.requesterClientSessionId || ""),
            requesterLabel: typeof data.requesterLabel === "string" ? data.requesterLabel : null,
            status:
              data.status === "approved" || data.status === "denied" ? data.status : "pending",
            grantedSessionId:
              typeof data.grantedSessionId === "string" ? data.grantedSessionId : null,
            grantedSessionName:
              typeof data.grantedSessionName === "string" ? data.grantedSessionName : null,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
            resolvedAt: typeof data.resolvedAt === "string" ? data.resolvedAt : null,
          } satisfies SessionAccessRequest;
        })
        .filter((r) => r.status === "pending" || r.status === "approved")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(rows[0] ?? null);
    },
    () => onUpdate(null)
  );
}

const GRANT_KEY = "paystack_contributor_session_id";

export function getContributorSessionId(): string | null {
  try {
    return sessionStorage.getItem(GRANT_KEY);
  } catch {
    return null;
  }
}

export function setContributorSessionId(sessionId: string | null): void {
  try {
    if (sessionId) sessionStorage.setItem(GRANT_KEY, sessionId);
    else sessionStorage.removeItem(GRANT_KEY);
  } catch {
    /* ignore */
  }
}
