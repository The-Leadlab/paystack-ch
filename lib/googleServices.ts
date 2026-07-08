import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_DRIVE_FOLDER_NAME = "Paystack Documents";

export type GoogleServicesResult =
  | { status: number; redirectUrl: string }
  | { status: number; json: Record<string, unknown> };

function parseTruthyEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true" || value === "1";
}

function resolveGoogleDriveEnv(baseVarName: string): string {
  const useTestMode = parseTruthyEnv(process.env.GOOGLE_DRIVE_USE_TEST_MODE);
  const varName = useTestMode ? `GOOGLE_DRIVE_TEST_${baseVarName}` : `GOOGLE_DRIVE_${baseVarName}`;
  const value = process.env[varName]?.trim();
  if (!value) {
    throw Object.assign(new Error(`Server missing ${varName}`), { status: 503 });
  }
  return value;
}

function resolveGoogleDriveClientId(): string {
  return resolveGoogleDriveEnv("CLIENT_ID");
}

function resolveGoogleDriveClientSecret(): string {
  return resolveGoogleDriveEnv("CLIENT_SECRET");
}

function resolveGoogleDriveRedirectUri(): string {
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (!redirectUri) {
    throw Object.assign(new Error("Server missing GOOGLE_DRIVE_REDIRECT_URI"), { status: 503 });
  }
  return redirectUri;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthState = { uid: string; nonce: string; expiresAt: number };

function stateSigningSecret(): string {
  const secret = process.env.GOOGLE_DRIVE_STATE_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw Object.assign(
      new Error("GOOGLE_DRIVE_STATE_SECRET is not configured (min 16 characters)."),
      { status: 503 }
    );
  }
  return secret;
}

/** HMAC-signed so a forged or tampered state (e.g. claiming another user's uid) is rejected. */
export function createOAuthState(uid: string): string {
  const payload = JSON.stringify({
    uid,
    nonce: nanoid(),
    expiresAt: Date.now() + STATE_TTL_MS,
  } satisfies OAuthState);
  const sig = createHmac("sha256", stateSigningSecret()).update(payload).digest("base64url");
  return Buffer.from(JSON.stringify({ payload, sig }), "utf8").toString("base64url");
}

export function decodeOAuthState(state: string): OAuthState {
  const invalid = () => Object.assign(new Error("Invalid or expired state parameter"), { status: 400 });

  let parsed: { payload?: string; sig?: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (!parsed.payload || !parsed.sig) throw invalid();

  const expectedSig = createHmac("sha256", stateSigningSecret()).update(parsed.payload).digest("base64url");
  const provided = Buffer.from(parsed.sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw invalid();
  }

  const inner = JSON.parse(parsed.payload) as OAuthState;
  if (!inner.uid || !inner.nonce || typeof inner.expiresAt !== "number") throw invalid();
  if (inner.expiresAt < Date.now()) throw invalid();

  return inner;
}

export async function startGoogleDriveOAuth(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", resolveGoogleDriveClientId());
  authUrl.searchParams.set("redirect_uri", resolveGoogleDriveRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", createOAuthState(uid));

  return { status: 302, redirectUrl: authUrl.toString() };
}

type GoogleTokenExchange = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function exchangeGoogleAuthCode(code: string): Promise<GoogleTokenExchange> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: resolveGoogleDriveClientId(),
      client_secret: resolveGoogleDriveClientSecret(),
      redirect_uri: resolveGoogleDriveRedirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to exchange Google authorization code"),
      { status: 400 }
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
  };
}

async function createGoogleDriveFolder(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw Object.assign(new Error(data.error?.message || "Failed to create Google Drive folder"), {
      status: 502,
    });
  }

  return data.id;
}

async function getExistingGoogleDriveFolderId(uid: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const folderId = (snap.data() as { googleDrive?: { folderId?: unknown } } | undefined)?.googleDrive
    ?.folderId;
  return typeof folderId === "string" ? folderId : null;
}

async function storeGoogleDriveConnection(
  uid: string,
  connection: { refreshToken: string; folderId: string }
): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set(
      {
        googleDrive: {
          refreshToken: connection.refreshToken,
          folderId: connection.folderId,
          connectedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

export async function completeGoogleDriveOAuth(
  code: string,
  state: string
): Promise<GoogleServicesResult> {
  try {
    const { uid } = decodeOAuthState(state);
    const tokens = await exchangeGoogleAuthCode(code);
    if (!tokens.refresh_token) {
      throw Object.assign(
        new Error("Google did not return a refresh token. Reconnect and grant consent again."),
        { status: 502 }
      );
    }
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const existingFolderId = await getExistingGoogleDriveFolderId(uid);
    const folderId = existingFolderId ?? (await createGoogleDriveFolder(tokens.access_token));
    await storeGoogleDriveConnection(uid, { refreshToken: tokens.refresh_token, folderId });
    return { status: 200, json: { connected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

async function getGoogleDriveRefreshToken(uid: string): Promise<string | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const refreshToken = (snap.data() as { googleDrive?: { refreshToken?: unknown } } | undefined)
    ?.googleDrive?.refreshToken;
  return typeof refreshToken === "string" ? refreshToken : null;
}

async function revokeGoogleToken(refreshToken: string): Promise<void> {
  const res = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  });
  if (!res.ok) {
    throw Object.assign(new Error("Failed to revoke Google Drive access"), { status: 502 });
  }
}

async function deleteGoogleDriveConnection(uid: string): Promise<void> {
  ensureFirebaseAdmin();
  await getFirestore()
    .collection("users")
    .doc(uid)
    .set({ googleDrive: FieldValue.delete() }, { merge: true });
}

export async function disconnectGoogleDrive(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
  let uid: string;
  try {
    uid = await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const refreshToken = await getGoogleDriveRefreshToken(uid);
    if (refreshToken) {
      try {
        await revokeGoogleToken(refreshToken);
      } catch {
        // Best-effort: the local connection is still cleared even if Google's revoke call fails
        // (e.g. the token was already revoked on Google's side, or a transient network error).
      }
    }
    await deleteGoogleDriveConnection(uid);
    return { status: 200, json: { disconnected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}

export type GoogleDriveConnection = { refreshToken: string; folderId: string };

async function getGoogleDriveConnection(uid: string): Promise<GoogleDriveConnection | null> {
  ensureFirebaseAdmin();
  const snap = await getFirestore().collection("users").doc(uid).get();
  const googleDrive = (
    snap.data() as { googleDrive?: { refreshToken?: unknown; folderId?: unknown } } | undefined
  )?.googleDrive;
  if (typeof googleDrive?.refreshToken === "string" && typeof googleDrive?.folderId === "string") {
    return { refreshToken: googleDrive.refreshToken, folderId: googleDrive.folderId };
  }
  return null;
}

async function getGoogleDriveAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: resolveGoogleDriveClientId(),
      client_secret: resolveGoogleDriveClientSecret(),
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw Object.assign(
      new Error(data.error_description || data.error || "Failed to refresh Google Drive access token"),
      { status: 401, code: data.error }
    );
  }

  return data.access_token;
}

export type DriveUploadFile = { bytes: Buffer; filename: string; mimeType: string };

async function uploadFileToDrive(accessToken: string, folderId: string, file: DriveUploadFile): Promise<string> {
  const boundary = `paystack-${nanoid()}`;
  const metadata = JSON.stringify({ name: file.filename, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
      "utf8"
    ),
    file.bytes,
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);

  const res = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

  if (!res.ok || !data.id) {
    throw Object.assign(new Error(data.error?.message || "Failed to upload document to Google Drive"), {
      status: 502,
    });
  }

  return data.id;
}

export async function saveDocumentToDrive(
  uid: string,
  file: DriveUploadFile
): Promise<GoogleServicesResult> {
  try {
    if (!hasFirebaseAdminCredentials()) {
      throw Object.assign(new Error("Server missing Firebase Admin credentials"), { status: 503 });
    }
    const connection = await getGoogleDriveConnection(uid);
    if (!connection) {
      return { status: 200, json: { skipped: true } };
    }
    const accessToken = await getGoogleDriveAccessToken(connection.refreshToken);
    const fileId = await uploadFileToDrive(accessToken, connection.folderId, file);
    return { status: 200, json: { uploaded: true, fileId } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}
