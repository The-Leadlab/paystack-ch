/**
 * One-shot privacy fix: update the phone number for cafedelaplace-geneve@bluewin.ch
 * in Firebase Auth from the old personal mobile to the placeholder.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON_BASE64="..." npx tsx scripts/fix-phone-cafedelaplace.mjs
 *   — or —
 *   Set the env var in .env and run: npx tsx scripts/fix-phone-cafedelaplace.mjs
 *
 * Safe to run multiple times (idempotent).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

try {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
} catch {
  /* ignore */
}

const TARGET_EMAIL = "cafedelaplace-geneve@bluewin.ch";
const NEW_PHONE = "+41765432111";

const { ensureFirebaseAdmin } = await import("../lib/firebaseAdmin.js");
ensureFirebaseAdmin();

const { getAuth } = await import("firebase-admin/auth");
const auth = getAuth();

const user = await auth.getUserByEmail(TARGET_EMAIL);
console.log(`Found user ${user.uid} (${user.displayName ?? "no name"})`);
console.log(`  current phone: ${user.phoneNumber ?? "(none)"}`);

if (user.phoneNumber === NEW_PHONE) {
  console.log("Phone already set to the placeholder — nothing to do.");
  process.exit(0);
}

await auth.updateUser(user.uid, { phoneNumber: NEW_PHONE });
console.log(`  updated phone → ${NEW_PHONE}`);
console.log("Done. You can delete this script after confirming the fix.");
