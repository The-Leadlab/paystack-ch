import { nanoid } from "nanoid";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ensureFirebaseAdmin, hasFirebaseAdminCredentials } from "./firebaseAdmin.js";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
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

export type OAuthState = { uid: string; nonce: string };

export function createOAuthState(uid: string): string {
  return Buffer.from(JSON.stringify({ uid, nonce: nanoid() } satisfies OAuthState)).toString(
    "base64url"
  );
}

export function decodeOAuthState(state: string): OAuthState {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as OAuthState;
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
    const folderId = await createGoogleDriveFolder(tokens.access_token);
    await storeGoogleDriveConnection(uid, { refreshToken: tokens.refresh_token, folderId });
    return { status: 200, json: { connected: true } };
  } catch (error) {
    const status = (error as { status?: number }).status || 400;
    return { status, json: { error: (error as Error).message } };
  }
}
