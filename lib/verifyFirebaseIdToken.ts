/**
 * Verify Firebase Auth ID tokens on the server.
 * When org policy blocks service-account key creation, use Identity Toolkit + FIREBASE_WEB_API_KEY.
 */
import { getAuth } from "firebase-admin/auth";
import { ensureFirebaseAdmin } from "./stripeBilling.js";

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim()
  );
}

function resolveFirebaseWebApiKey(): string {
  const key =
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.VITE_FIREBASE_API_KEY?.trim();
  if (!key) {
    throw Object.assign(
      new Error(
        "Server missing FIREBASE_WEB_API_KEY (use the same Web API Key as VITE_FIREBASE_API_KEY). " +
          "Your organisation blocks service-account private keys; this key verifies signed-in users for /api/gemini instead."
      ),
      { status: 503 }
    );
  }
  return key;
}

async function verifyWithIdentityToolkit(idToken: string): Promise<string> {
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
    users?: Array<{ localId?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error?.message || "Invalid or expired sign-in token. Sign out and sign in again."),
      { status: 401 }
    );
  }

  const uid = data.users?.[0]?.localId;
  if (!uid) {
    throw Object.assign(new Error("Invalid authentication token"), { status: 401 });
  }
  return uid;
}

/** Returns Firebase Auth uid for a valid ID token. */
export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  if (hasFirebaseAdminCredentials()) {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(idToken, true);
    if (!decoded.uid) {
      throw Object.assign(new Error("Invalid authentication token"), { status: 401 });
    }
    return decoded.uid;
  }
  return verifyWithIdentityToolkit(idToken);
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
