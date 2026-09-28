/**
 * Creates the named Firestore database used by Admin UK UAT.
 *
 * Usage (from repo root, with FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or
 * FIREBASE_SERVICE_ACCOUNT_JSON in .env):
 *   node scripts/create-admin-uk-firestore.mjs
 *
 * Optional env:
 *   VITE_FIRESTORE_ADMIN_UK_DATABASE_ID  (default: admin-uk-uat)
 *   FIRESTORE_ADMIN_UK_LOCATION          (default: eur3 — same as production firebase.json)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSign } from "node:crypto";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return JSON.parse(inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf8"));
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    return JSON.parse(Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8"));
  }
  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON in .env"
  );
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function serviceAccountAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const key = String(sa.private_key || "").replace(/\\n/g, "\n");
  const sig = signer.sign(key).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  }).then(async (res) => {
    const body = await res.json();
    if (!res.ok || !body.access_token) {
      throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
    }
    return body.access_token;
  });
}

loadDotEnv();

const DATABASE_ID =
  process.env.VITE_FIRESTORE_ADMIN_UK_DATABASE_ID?.trim() || "admin-uk-uat";
/** Match production `firebase.json` multi-region (eur3) unless overridden. */
const LOCATION = process.env.FIRESTORE_ADMIN_UK_LOCATION?.trim() || "eur3";

async function main() {
  const sa = loadServiceAccount();
  const projectId = sa.project_id || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("No project_id on service account / env");

  const token = await serviceAccountAccessToken(sa);
  const parent = `projects/${projectId}`;
  const listUrl = `https://firestore.googleapis.com/v1/${parent}/databases`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listBody = await listRes.json();
  if (!listRes.ok) {
    console.error(listBody);
    throw new Error(`List databases failed: ${listRes.status}`);
  }

  const existing = (listBody.databases || []).find((d) =>
    String(d.name || "").endsWith(`/databases/${DATABASE_ID}`)
  );
  if (existing) {
    console.log(`OK — database already exists: ${existing.name}`);
    console.log(`  location: ${existing.locationId || existing.location || "?"}`);
    console.log(`  type: ${existing.type || "?"}`);
    return;
  }

  console.log(`Creating Firestore database "${DATABASE_ID}" in ${LOCATION} (project ${projectId})…`);
  const createUrl = `https://firestore.googleapis.com/v1/${parent}/databases?databaseId=${encodeURIComponent(DATABASE_ID)}`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationId: LOCATION,
      type: "FIRESTORE_NATIVE",
    }),
  });
  const createBody = await createRes.json();
  if (!createRes.ok) {
    console.error(createBody);
    throw new Error(`Create database failed: ${createRes.status}`);
  }

  console.log("Create accepted (long-running operation):");
  console.log(JSON.stringify(createBody, null, 2));
  console.log(`\nDeploy rules to both databases:`);
  console.log(`  npx firebase-tools deploy --only firestore:rules --project ${projectId}`);
  console.log(`Admin UK UAT will use database id: ${DATABASE_ID}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
