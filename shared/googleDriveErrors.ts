export const GOOGLE_DRIVE_ERROR_REASONS = [
  "firebase_admin",
  "no_refresh_token",
  "invalid_state",
  "redirect_mismatch",
  "missing_config",
  "oauth_denied",
  "unknown",
] as const;

export type GoogleDriveErrorReason = (typeof GOOGLE_DRIVE_ERROR_REASONS)[number];

export function resolveGoogleDriveErrorReason(message: string): GoogleDriveErrorReason {
  const m = message.toLowerCase();
  if (m.includes("firebase admin") || m.includes("service_account")) return "firebase_admin";
  if (m.includes("refresh token")) return "no_refresh_token";
  if (m.includes("state parameter") || m.includes("invalid or expired state")) return "invalid_state";
  if (m.includes("redirect_uri") || m.includes("redirect uri")) return "redirect_mismatch";
  if (m.includes("server missing google_drive") || m.includes("not configured")) return "missing_config";
  if (m.includes("access_denied") || m.includes("access blocked")) return "oauth_denied";
  return "unknown";
}

export function googleDriveErrorUserMessage(reason: GoogleDriveErrorReason): string {
  switch (reason) {
    case "firebase_admin":
      return "Google sign-in worked, but Paystack could not save the connection. Add FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) in Vercel, then redeploy.";
    case "no_refresh_token":
      return "Google did not issue a refresh token. Disconnect Paystack in your Google Account → Security → Third-party access, then connect again.";
    case "invalid_state":
      return "The connection session expired or was started on a different environment. Try Connect again from the same site (paystack.ch).";
    case "redirect_mismatch":
      return "OAuth redirect URI mismatch. In Google Cloud Console, add exactly: https://paystack.ch/api/oauth/google/callback";
    case "missing_config":
      return "Google Drive is not configured on the server (missing GOOGLE_DRIVE_* env vars on Vercel).";
    case "oauth_denied":
      return "Google access was denied or the OAuth app is in Testing mode without your account as a test user.";
    default:
      return "Could not connect Google Drive. Check Vercel env vars (GOOGLE_DRIVE_* and Firebase Admin JSON), then try again.";
  }
}

export function googleDriveCallbackRedirect(
  origin: string,
  ok: boolean,
  reason?: GoogleDriveErrorReason
): string {
  const params = new URLSearchParams({ googleDrive: ok ? "connected" : "error" });
  if (!ok && reason) params.set("googleDriveReason", reason);
  return `${origin}/app?${params.toString()}`;
}
