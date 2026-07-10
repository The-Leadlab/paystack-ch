import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";

function normalizeServiceAccountJsonInput(raw: string): string {
  let body = raw.trim().replace(/^\uFEFF/, "");
  if (
    (body.startsWith('"') && body.endsWith('"')) ||
    (body.startsWith("'") && body.endsWith("'"))
  ) {
    body = body.slice(1, -1).trim();
  }
  // Common mistake: pasting .env line "FIREBASE_SERVICE_ACCOUNT_JSON={...}"
  const envPrefix = /^FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*/i;
  if (envPrefix.test(body)) {
    body = body.replace(envPrefix, "").trim();
  }
  return body;
}

function parseServiceAccountJson(raw: string): ServiceAccount {
  const body = normalizeServiceAccountJsonInput(raw);
  if (!body.startsWith("{")) {
    throw new Error(
      'Expected full service account JSON (starts with {"type":"service_account",...}). ' +
        "Do not paste the Key ID from Google Cloud — download the .json key file instead."
    );
  }
  return JSON.parse(body) as ServiceAccount;
}

function loadServiceAccountJson(): string {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return inline;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  throw Object.assign(
    new Error(
      "Server missing Firebase Admin credentials. In Vercel → Environment Variables add " +
        "FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON on one line) or " +
        "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, then redeploy."
    ),
    { status: 503 }
  );
}

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim()
  );
}

export function ensureFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  if (!hasFirebaseAdminCredentials()) {
    throw Object.assign(
      new Error("Firebase Admin credentials are not configured on this server."),
      { status: 503 }
    );
  }
  let cred: ServiceAccount;
  try {
    cred = parseServiceAccountJson(loadServiceAccountJson());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw Object.assign(new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${msg}`), { status: 503 });
  }
  initializeApp({ credential: cert(cred) });
}
