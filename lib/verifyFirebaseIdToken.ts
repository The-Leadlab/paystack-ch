/**
 * Verify Firebase Auth ID tokens on the server.
 * When org policy blocks service-account key creation, use Identity Toolkit + FIREBASE_WEB_API_KEY.
 */
import { getAuth } from "firebase-admin/auth";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";

export { hasFirebaseAdminCredentials } from "./firebaseAdmin.js";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

function resolveFirebaseWebApiKey(): string {
  const key =
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.VITE_FIREBASE_API_KEY?.trim();
  if (!key) {
    throw Object.assign(
      new Error(
        "Server missing Firebase Web API key. On Vercel set FIREBASE_WEB_API_KEY or reuse VITE_FIREBASE_API_KEY (same value). " +
          "Required when service-account private keys are blocked."
      ),
      { status: 503 }
    );
  }
  return key;
}

async function verifyWithIdentityToolkit(idToken: string): Promise<VerifiedFirebaseUser> {
  const apiKey = resolveFirebaseWebApiKey();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  const data = (await res.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; email?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error?.message || "Invalid or expired sign-in token. Sign out and sign in again."),
      { status: 401 }
    );
  }

  const user = data.users?.[0];
  const uid = user?.localId;
  if (!uid) {
    throw Object.assign(new Error("Invalid authentication token"), { status: 401 });
  }
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : null;
  return { uid, email };
}

/** Returns Firebase Auth uid + email for a valid ID token. */
export async function verifyFirebaseUser(idToken: string): Promise<VerifiedFirebaseUser> {
  if (hasFirebaseAdminCredentials()) {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(idToken, true);
    if (!decoded.uid) {
      throw Object.assign(new Error("Invalid authentication token"), { status: 401 });
    }
    const email = decoded.email ? decoded.email.trim().toLowerCase() : null;
    return { uid: decoded.uid, email };
  }
  return verifyWithIdentityToolkit(idToken);
}

/** Returns Firebase Auth uid for a valid ID token. */
export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const { uid } = await verifyFirebaseUser(idToken);
  return uid;
}

export async function verifyFirebaseAuthorizationHeader(
  authorization: string | undefined
): Promise<string> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  }
  return verifyFirebaseIdToken(token);
}
