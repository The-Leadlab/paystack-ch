import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";

const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";
const PEM_BEGIN_RSA = "-----BEGIN RSA PRIVATE KEY-----";
const PEM_END_RSA = "-----END RSA PRIVATE KEY-----";

/** Fixes common Vercel paste issues (stripped \\n, single-line PEM). */
export function normalizeServiceAccountPrivateKey(privateKey: string): string {
  let key = privateKey.trim();
  if (!key) return key;

  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  const pairs: [string, string][] = [
    [PEM_BEGIN, PEM_END],
    [PEM_BEGIN_RSA, PEM_END_RSA],
  ];

  for (const [begin, end] of pairs) {
    if (!key.includes(begin) || !key.includes(end)) continue;

    const start = key.indexOf(begin);
    const endIdx = key.indexOf(end);
    if (start === -1 || endIdx === -1 || endIdx <= start) continue;

    const body = key.slice(start + begin.length, endIdx).replace(/\s+/g, "");
    if (!body) continue;

    const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
    key = `${begin}\n${wrapped}\n${end}\n`;
    break;
  }

  if (!key.endsWith("\n")) key += "\n";
  return key;
}

export function normalizeServiceAccount(cred: ServiceAccount): ServiceAccount {
  if (typeof cred.private_key !== "string") return cred;
  return {
    ...cred,
    private_key: normalizeServiceAccountPrivateKey(cred.private_key),
  };
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function looksLikeBase64(value: string): boolean {
  return /^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").startsWith("eyJ");
}

function loadServiceAccountJson(): string {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return stripBom(inline);
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    return stripBom(Buffer.from(b64.replace(/\s/g, ""), "base64").toString("utf8"));
  }
  throw Object.assign(
    new Error(
      "Server missing Firebase Admin credentials. In Vercel → Environment Variables add " +
        "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (recommended) or FIREBASE_SERVICE_ACCOUNT_JSON, then redeploy."
    ),
    { status: 503 }
  );
}

export function parseServiceAccountJson(jsonText: string): ServiceAccount {
  const trimmed = stripBom(jsonText.trim());
  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(trimmed) as ServiceAccount;
  } catch (firstError) {
    if (looksLikeBase64(trimmed)) {
      parsed = JSON.parse(Buffer.from(trimmed.replace(/\s/g, ""), "base64").toString("utf8")) as ServiceAccount;
    } else {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      throw Object.assign(new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${msg}`), { status: 503 });
    }
  }
  return normalizeServiceAccount(parsed);
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
    if ((e as { status?: number }).status === 503) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw Object.assign(new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${msg}`), { status: 503 });
  }
  try {
    initializeApp({ credential: cert(cred) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw Object.assign(
      new Error(
        `Invalid Firebase service account private key: ${msg}. ` +
          "Use FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (full downloaded .json file, base64-encoded) in Vercel."
      ),
      { status: 503 }
    );
  }
}
