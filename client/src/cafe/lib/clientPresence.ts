import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getLocalClientSessionId } from "./activeClientSession";

export type ClientPresenceRole = "primary" | "viewer" | "contributor";

export type ClientPresence = {
  clientSessionId: string;
  displayName: string;
  color: string;
  role: ClientPresenceRole;
  lastSeenAt: string | null;
  isSelf: boolean;
};

/** Brand-adjacent palette — no purple defaults. */
const PRESENCE_COLORS = [
  "#C45C26", // terracotta
  "#B8860B", // dark gold
  "#2F6F5E", // deep teal
  "#8B3A3A", // brick
  "#3D5A80", // slate blue
  "#6B4F3A", // walnut
  "#A65D2E", // amber rust
  "#1F6B5C", // pine
];

const GUEST_LABELS = [
  "Atlas",
  "Nova",
  "Orion",
  "Lumen",
  "Cedar",
  "Sol",
  "Harbor",
  "Maple",
  "Ridge",
  "Cove",
  "Flint",
  "Willow",
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function presenceColorForId(clientSessionId: string): string {
  return PRESENCE_COLORS[hashString(clientSessionId) % PRESENCE_COLORS.length];
}

export function presenceNameForId(clientSessionId: string, role: ClientPresenceRole): string {
  if (role === "primary") return "Host";
  const label = GUEST_LABELS[hashString(clientSessionId) % GUEST_LABELS.length];
  if (role === "contributor") return label;
  return label;
}

export function presenceInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function presenceCol(uid: string) {
  if (!db) throw new Error("Firestore not configured");
  return collection(db, "users", uid, "clientPresence");
}

/** Keep this browser visible to other shared-login clients. */
export async function upsertClientPresence(
  uid: string,
  role: ClientPresenceRole
): Promise<void> {
  const clientSessionId = getLocalClientSessionId();
  if (!clientSessionId || !db) return;
  const displayName = presenceNameForId(clientSessionId, role);
  const color = presenceColorForId(clientSessionId);
  await setDoc(
    doc(db, "users", uid, "clientPresence", clientSessionId),
    {
      clientSessionId,
      displayName,
      color,
      role,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearClientPresence(uid: string): Promise<void> {
  const clientSessionId = getLocalClientSessionId();
  if (!clientSessionId || !db) return;
  try {
    await deleteDoc(doc(db, "users", uid, "clientPresence", clientSessionId));
  } catch {
    /* best-effort */
  }
}

const STALE_MS = 90_000;

export function watchClientPresence(
  uid: string,
  onChange: (peers: ClientPresence[]) => void
): Unsubscribe {
  if (!db) {
    onChange([]);
    return () => undefined;
  }
  const local = getLocalClientSessionId();
  return onSnapshot(
    presenceCol(uid),
    (snap) => {
      const now = Date.now();
      const peers: ClientPresence[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const clientSessionId =
          typeof data.clientSessionId === "string" ? data.clientSessionId : d.id;
        let lastMs: number | null = null;
        const rawLast = data.lastSeenAt;
        if (rawLast && typeof rawLast === "object" && "toDate" in (rawLast as object)) {
          try {
            lastMs = (rawLast as { toDate: () => Date }).toDate().getTime();
          } catch {
            lastMs = null;
          }
        } else if (typeof rawLast === "string") {
          const parsed = Date.parse(rawLast);
          lastMs = Number.isFinite(parsed) ? parsed : null;
        }
        if (lastMs != null && now - lastMs > STALE_MS) continue;

        const roleRaw = String(data.role || "viewer");
        const role: ClientPresenceRole =
          roleRaw === "primary" || roleRaw === "contributor" ? roleRaw : "viewer";
        const displayName =
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : presenceNameForId(clientSessionId, role);
        const color =
          typeof data.color === "string" && data.color
            ? data.color
            : presenceColorForId(clientSessionId);

        peers.push({
          clientSessionId,
          displayName,
          color,
          role,
          lastSeenAt: lastMs != null ? new Date(lastMs).toISOString() : null,
          isSelf: clientSessionId === local,
        });
      }
      peers.sort((a, b) => {
        if (a.role === "primary" && b.role !== "primary") return -1;
        if (b.role === "primary" && a.role !== "primary") return 1;
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
      onChange(peers);
    },
    () => onChange([])
  );
}
