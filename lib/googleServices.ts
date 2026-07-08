import { nanoid } from "nanoid";
import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export type GoogleServicesResult =
  | { status: number; redirectUrl: string }
  | { status: number; json: Record<string, unknown> };

function resolveGoogleDriveClientId(): string {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  if (!clientId) {
    throw Object.assign(new Error("Server missing GOOGLE_DRIVE_CLIENT_ID"), { status: 503 });
  }
  return clientId;
}

function resolveGoogleDriveRedirectUri(): string {
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (!redirectUri) {
    throw Object.assign(new Error("Server missing GOOGLE_DRIVE_REDIRECT_URI"), { status: 503 });
  }
  return redirectUri;
}

export type OAuthState = { uid: string; nonce: string };

function createOAuthState(uid: string): string {
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
