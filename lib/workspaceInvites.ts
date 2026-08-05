/**
 * Team workspace invites — email invite → accept → member reads/writes owner's restaurantId data.
 * See docs/TEAM_INVITE_SUPER_PROMPT.md
 */
import { createHash, randomBytes } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { entitlementsForPlan, parsePaystackPlanId } from "../shared/planCatalog.js";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { publicAppOriginFromHeaders, isAllowedBrowserOrigin, type HeaderMap } from "./stripeCore.js";
import { sendResendEmail } from "./resendEmail.js";
import { verifyFirebaseUser } from "./verifyFirebaseIdToken.js";

export type WorkspaceRole = "owner" | "editor" | "viewer";

const INVITES = "workspaceInvites";
const MEMBERS = "workspaceMembers";
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseBearer(authorization: string | undefined): string | null {
  const m = (authorization || "").match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function countSeatsUsed(ownerUid: string): Promise<number> {
  const db = getFirestore();
  const members = await db.collection(MEMBERS).where("ownerUid", "==", ownerUid).where("status", "==", "active").get();
  const pending = await db
    .collection(INVITES)
    .where("ownerUid", "==", ownerUid)
    .where("status", "==", "pending")
    .get();
  // Owner counts as 1 seat
  return 1 + members.size + pending.size;
}

async function ownerPlanSeats(ownerUid: string): Promise<number | null> {
  const snap = await getFirestore().collection("users").doc(ownerUid).get();
  const planId = parsePaystackPlanId(snap.get("planId"));
  const caps = entitlementsForPlan(planId);
  return caps.maxTeamSeats;
}

export async function runTeamAction(
  authorization: string | undefined,
  body: Record<string, unknown>,
  headers: HeaderMap
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!isAllowedBrowserOrigin(headers)) {
    return { status: 403, json: { error: "Origin not allowed" } };
  }
  const token = parseBearer(authorization);
  if (!token) {
    return { status: 401, json: { error: "Missing Authorization Bearer token" } };
  }
  if (!hasFirebaseAdminCredentials()) {
    return { status: 503, json: { error: "Firebase Admin is not configured." } };
  }
  ensureFirebaseAdmin();

  const { uid, email: authEmail } = await verifyFirebaseUser(token);
  const action = String(body.action || "").trim();

  try {
    switch (action) {
      case "list":
        return await listTeam(uid, authEmail);
      case "invite":
        return await createInvite(uid, authEmail, body, headers);
      case "revoke_invite":
        return await revokeInvite(uid, String(body.inviteId || ""));
      case "remove_member":
        return await removeMember(uid, String(body.memberUid || ""));
      case "accept":
        return await acceptInvite(uid, authEmail, String(body.token || ""));
      case "leave":
        return await leaveWorkspace(uid);
      default:
        return { status: 400, json: { error: "Unknown action. Use list|invite|revoke_invite|remove_member|accept|leave." } };
    }
  } catch (e) {
    console.error("[team]", action, e);
    const msg = e instanceof Error ? e.message : "Team action failed";
    const status = (e as { status?: number }).status;
    return { status: typeof status === "number" ? status : 500, json: { error: msg } };
  }
}

async function listTeam(uid: string, authEmail: string | null) {
  const db = getFirestore();
  const membership = await db.collection(MEMBERS).doc(uid).get();
  const memberOf =
    membership.exists && membership.get("status") === "active"
      ? {
          ownerUid: membership.get("ownerUid") as string,
          role: membership.get("role") as WorkspaceRole,
          ownerEmail: (membership.get("ownerEmail") as string) || null,
        }
      : null;

  const ownerUid = memberOf?.ownerUid || uid;
  const isOwner = !memberOf;

  const membersSnap = await db.collection(MEMBERS).where("ownerUid", "==", ownerUid).where("status", "==", "active").get();
  const members = membersSnap.docs.map((d) => ({
    uid: d.id,
    email: (d.get("email") as string) || "",
    role: d.get("role") as WorkspaceRole,
    status: "active" as const,
  }));

  let invites: Array<{ id: string; email: string; role: WorkspaceRole; status: string; expiresAt: string | null }> = [];
  if (isOwner) {
    const invitesSnap = await db.collection(INVITES).where("ownerUid", "==", ownerUid).where("status", "==", "pending").get();
    invites = invitesSnap.docs.map((d) => {
      const exp = d.get("expiresAt") as Timestamp | undefined;
      return {
        id: d.id,
        email: (d.get("email") as string) || "",
        role: d.get("role") as WorkspaceRole,
        status: "pending",
        expiresAt: exp?.toDate?.()?.toISOString?.() ?? null,
      };
    });
  }

  const maxSeats = await ownerPlanSeats(ownerUid);
  const usedSeats = await countSeatsUsed(ownerUid);

  return {
    status: 200,
    json: {
      ownerUid,
      isOwner,
      authEmail,
      memberOf,
      members,
      invites,
      seats: { used: usedSeats, max: maxSeats },
    },
  };
}

async function createInvite(
  ownerUid: string,
  ownerEmail: string | null,
  body: Record<string, unknown>,
  headers: HeaderMap
) {
  const email = normalizeEmail(String(body.email || ""));
  if (!email || !email.includes("@")) {
    return { status: 400, json: { error: "Valid invite email is required." } };
  }
  if (ownerEmail && email === ownerEmail) {
    return { status: 400, json: { error: "You cannot invite yourself." } };
  }

  const membership = await getFirestore().collection(MEMBERS).doc(ownerUid).get();
  if (membership.exists && membership.get("status") === "active") {
    return { status: 403, json: { error: "Only the workspace owner can send invites." } };
  }

  const maxSeats = await ownerPlanSeats(ownerUid);
  if (maxSeats != null && maxSeats <= 1) {
    return { status: 403, json: { error: "Your plan allows 1 seat (owner only). Upgrade to Business to invite teammates." } };
  }
  const used = await countSeatsUsed(ownerUid);
  if (maxSeats != null && used >= maxSeats) {
    return { status: 403, json: { error: `Seat limit reached (${used}/${maxSeats}). Upgrade or remove a member.` } };
  }

  const roleRaw = String(body.role || "editor").toLowerCase();
  const role: WorkspaceRole = roleRaw === "viewer" ? "viewer" : "editor";

  const db = getFirestore();
  const existingPending = await db
    .collection(INVITES)
    .where("ownerUid", "==", ownerUid)
    .where("email", "==", email)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existingPending.empty) {
    return { status: 400, json: { error: "An invite is already pending for this email." } };
  }

  const rawToken = randomBytes(32).toString("hex");
  const inviteRef = db.collection(INVITES).doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS);
  await inviteRef.set({
    ownerUid,
    ownerEmail: ownerEmail || null,
    email,
    role,
    tokenHash: hashToken(rawToken),
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  const origin = publicAppOriginFromHeaders(headers);
  const acceptUrl = `${origin}/app?team_invite=${encodeURIComponent(rawToken)}`;

  try {
    await sendResendEmail({
      to: [email],
      subject: "You're invited to a Paystack.ch workspace",
      html: `
        <p>You've been invited to collaborate on a Paystack.ch financial dashboard${ownerEmail ? ` by <strong>${ownerEmail}</strong>` : ""}.</p>
        <p><a href="${acceptUrl}">Accept invite</a></p>
        <p>This link expires in 14 days. If you don't have an account yet, sign up with <strong>${email}</strong> first, then open the link.</p>
        <p style="color:#666;font-size:12px;">If you weren't expecting this, you can ignore this email.</p>
      `,
    });
  } catch (e) {
    await inviteRef.delete();
    throw e;
  }

  return {
    status: 200,
    json: { ok: true, inviteId: inviteRef.id, email, role },
  };
}

async function revokeInvite(ownerUid: string, inviteId: string) {
  if (!inviteId) return { status: 400, json: { error: "inviteId required" } };
  const ref = getFirestore().collection(INVITES).doc(inviteId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("ownerUid") !== ownerUid) {
    return { status: 404, json: { error: "Invite not found." } };
  }
  await ref.set({ status: "revoked", revokedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { status: 200, json: { ok: true } };
}

async function removeMember(ownerUid: string, memberUid: string) {
  if (!memberUid) return { status: 400, json: { error: "memberUid required" } };
  if (memberUid === ownerUid) {
    return { status: 400, json: { error: "Cannot remove the owner." } };
  }
  const ref = getFirestore().collection(MEMBERS).doc(memberUid);
  const snap = await ref.get();
  if (!snap.exists || snap.get("ownerUid") !== ownerUid) {
    return { status: 404, json: { error: "Member not found." } };
  }
  await ref.delete();
  return { status: 200, json: { ok: true } };
}

async function acceptInvite(uid: string, authEmail: string | null, rawToken: string) {
  if (!rawToken) return { status: 400, json: { error: "Invite token required." } };
  if (!authEmail) return { status: 400, json: { error: "Your account needs an email to accept invites." } };

  const db = getFirestore();
  const tokenHash = hashToken(rawToken);
  const q = await db.collection(INVITES).where("tokenHash", "==", tokenHash).where("status", "==", "pending").limit(1).get();
  if (q.empty) {
    return { status: 404, json: { error: "Invite not found or already used." } };
  }
  const inviteDoc = q.docs[0];
  const inviteEmail = normalizeEmail(String(inviteDoc.get("email") || ""));
  if (inviteEmail !== authEmail) {
    return {
      status: 403,
      json: { error: `Sign in with ${inviteEmail} to accept this invite (you are signed in as ${authEmail}).` },
    };
  }

  const expiresAt = inviteDoc.get("expiresAt") as Timestamp | undefined;
  if (expiresAt && expiresAt.toMillis() < Date.now()) {
    await inviteDoc.ref.set({ status: "expired" }, { merge: true });
    return { status: 400, json: { error: "This invite has expired." } };
  }

  const ownerUid = inviteDoc.get("ownerUid") as string;
  if (ownerUid === uid) {
    return { status: 400, json: { error: "You already own this workspace." } };
  }

  const existing = await db.collection(MEMBERS).doc(uid).get();
  if (existing.exists && existing.get("status") === "active" && existing.get("ownerUid") !== ownerUid) {
    return { status: 400, json: { error: "You already belong to another workspace. Leave it first." } };
  }

  const maxSeats = await ownerPlanSeats(ownerUid);
  const used = await countSeatsUsed(ownerUid);
  // Accepting converts a pending invite into a member — seats roughly stay same, but guard anyway
  if (maxSeats != null && used > maxSeats) {
    return { status: 403, json: { error: "This workspace is full." } };
  }

  const role = (inviteDoc.get("role") as WorkspaceRole) || "editor";
  const ownerEmail = (inviteDoc.get("ownerEmail") as string) || null;

  await db.collection(MEMBERS).doc(uid).set({
    ownerUid,
    ownerEmail,
    email: authEmail,
    role,
    status: "active",
    joinedAt: FieldValue.serverTimestamp(),
  });
  await inviteDoc.ref.set(
    { status: "accepted", acceptedAt: FieldValue.serverTimestamp(), acceptedByUid: uid },
    { merge: true }
  );

  return {
    status: 200,
    json: { ok: true, ownerUid, role, ownerEmail },
  };
}

async function leaveWorkspace(uid: string) {
  const ref = getFirestore().collection(MEMBERS).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return { status: 400, json: { error: "You are not a member of a shared workspace." } };
  }
  await ref.delete();
  return { status: 200, json: { ok: true } };
}
