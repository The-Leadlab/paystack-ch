/**
 * Dry-run: list users where incorporationCountry === 'gb' but taxRegion === 'ch'
 * and residencyCountry === 'ch' (likely victims of the BillingPlanPanel precedence bug).
 *
 * Usage (needs Firebase Admin JSON):
 *   node scripts/list-uk-incorporation-ch-tax-mismatch.mjs
 *
 * Does NOT write or repair production data.
 */
import { readFileSync, existsSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return JSON.parse(raw);
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS");
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  const db = getFirestore();
  const snap = await db.collection("users").get();
  const hits = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (
      d.incorporationCountry === "gb" &&
      d.taxRegion === "ch" &&
      (d.residencyCountry === "ch" || !d.residencyCountry)
    ) {
      hits.push({
        uid: doc.id,
        email: d.email || null,
        residencyCountry: d.residencyCountry || null,
        incorporationCountry: d.incorporationCountry,
        taxRegion: d.taxRegion,
      });
    }
  }
  console.log(`Dry-run only. Found ${hits.length} candidate(s):`);
  console.log(JSON.stringify(hits, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
