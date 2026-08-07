/**
 * Seed personal ledger + Storage for ali@the-leadlab.com from fixtures.
 * Also attempts Drive backup when the user already connected Google Drive.
 *
 * Usage: npx tsx scripts/seed-personal-ali-e2e.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load .env if present (without overriding existing env)
try {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
} catch {
  /* ignore */
}

const EMAIL = process.env.PERSONAL_E2E_EMAIL || "ali@the-leadlab.com";
const results = {
  startedAt: new Date().toISOString(),
  email: EMAIL,
  steps: [],
};

function step(name, ok, detail = {}) {
  results.steps.push({ name, ok, ...detail, at: new Date().toISOString() });
  console.log(ok ? "OK " : "FAIL", name, detail.error || detail.message || "");
}

async function main() {
  const { ensureFirebaseAdmin, hasFirebaseAdminCredentials } = await import("../lib/firebaseAdmin.ts");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  const { saveDocumentToDrive, computePersonalDateFolderName } = await import("../lib/googleServices.ts");

  if (!hasFirebaseAdminCredentials()) {
    step("firebase_admin", false, { error: "Missing Firebase Admin credentials in env" });
    writeResults();
    process.exitCode = 1;
    return;
  }

  ensureFirebaseAdmin();
  step("firebase_admin", true);

  let user;
  try {
    user = await getAuth().getUserByEmail(EMAIL);
    step("lookup_user", true, { uid: user.uid });
  } catch (e) {
    step("lookup_user", false, { error: e instanceof Error ? e.message : String(e) });
    writeResults();
    process.exitCode = 1;
    return;
  }

  const uid = user.uid;
  const csvPath = path.join(root, "fixtures/personal/ali-bank-statement-2026-07.csv");
  const pdfPath = path.join(root, "fixtures/personal/ali-bank-statement-2026-07.pdf");
  if (!fs.existsSync(csvPath) || !fs.existsSync(pdfPath)) {
    step("fixtures", false, { error: "Missing CSV/PDF fixtures under fixtures/personal/" });
    writeResults();
    process.exitCode = 1;
    return;
  }
  step("fixtures", true, { csv: csvPath, pdf: pdfPath });

  // Parse CSV the same way as the client (lightweight mirror)
  const csvText = fs.readFileSync(csvPath, "utf8");
  const rows = [];
  for (const line of csvText.trim().split(/\r?\n/).slice(1)) {
    const [date, description, amountRaw] = line.split(",");
    const amount = Number(amountRaw);
    if (!date || !description || !Number.isFinite(amount) || amount === 0) continue;
    rows.push({
      date: date.trim(),
      description: description.trim(),
      amount: Math.abs(amount),
      kind: amount < 0 ? "expense" : "income",
      expenseCat: "SHOPPING_OTHER",
      incomeCat: "SALARY",
      source: "statement",
    });
  }
  // Better categories (mirror keywords)
  for (const r of rows) {
    const d = r.description.toLowerCase();
    if (d.includes("salary")) r.incomeCat = "SALARY";
    else if (d.includes("dividend")) r.incomeCat = "ASSET_REVENUE";
    else if (d.includes("gift") || d.includes("contribution")) r.incomeCat = "CONTRIBUTIONS";
    if (d.includes("migros") || d.includes("coop")) r.expenseCat = "GROCERIES";
    else if (d.includes("rent")) r.expenseCat = "RENT";
    else if (d.includes("swisscom") || d.includes("serafe")) r.expenseCat = "BILLS";
    else if (d.includes("uber")) r.expenseCat = "GOING_OUT";
    else if (d.includes("pillar") || d.includes("viac")) r.expenseCat = "SAVINGS_INVEST";
  }

  const incomeTotal = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  const expenseTotal = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  step("csv_parse", rows.length >= 8, {
    rowCount: rows.length,
    incomeTotal,
    expenseTotal,
    savings: incomeTotal - expenseTotal,
  });

  const db = getFirestore();
  const importId = `pim_e2e_${Date.now().toString(36)}`;
  const importedAt = new Date().toISOString();
  const batch = db.batch();

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const id = `ptx_e2e_${Date.now().toString(36)}_${i}`;
    batch.set(db.collection("personal_transactions").doc(id), {
      ...r,
      id,
      importId,
      createdAt: importedAt,
      restaurantId: uid,
      e2eSeed: true,
    });
  }
  batch.set(db.collection("personal_imports").doc(importId), {
    id: importId,
    fileName: path.basename(csvPath),
    source: "csv",
    importedAt,
    rowCount: rows.length,
    incomeTotal,
    expenseTotal,
    restaurantId: uid,
    e2eSeed: true,
  });
  await batch.commit();
  step("firestore_seed", true, { importId, transactions: rows.length });

  // Storage upload
  const dateFolder = "2026-07-01";
  const pdfBytes = fs.readFileSync(pdfPath);
  const storagePath = `documents/${uid}/personal/${dateFolder}/ali-bank-statement-2026-07.pdf`;
  let fileUrl = "";
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(pdfBytes, { contentType: "application/pdf", resumable: false });
    const [signed] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    fileUrl = signed;
    step("storage_upload", true, { storagePath });
  } catch (e) {
    step("storage_upload", false, { error: e instanceof Error ? e.message : String(e), storagePath });
  }

  // Drive backup (if connected)
  try {
    const driveOut = await saveDocumentToDrive(uid, {
      bytes: pdfBytes,
      filename: "ali-bank-statement-2026-07.pdf",
      mimeType: "application/pdf",
      sourceId: storagePath,
      documentDate: dateFolder,
      workspace: "personal",
    });
    const json = "json" in driveOut ? driveOut.json : {};
    const skipped = Boolean(json.skipped);
    const uploaded = Boolean(json.uploaded);
    step("drive_personal_backup", driveOut.status === 200, {
      status: driveOut.status,
      skipped,
      uploaded,
      fileId: json.fileId,
      personalPath: json.personalPath || `Personal/${computePersonalDateFolderName(new Date(dateFolder))}`,
      message: skipped
        ? "User has not connected Google Drive yet — connect from /personal/overview"
        : uploaded
          ? "Uploaded to Personal date folder"
          : json.error || "unknown",
    });
  } catch (e) {
    step("drive_personal_backup", false, { error: e instanceof Error ? e.message : String(e) });
  }

  // Feature surface checklist (code-level: panels exist)
  const featureFiles = {
    overview: "client/src/ali-lab/features/PersonalDashboardPanel.tsx",
    budgeting: "client/src/ali-lab/features/BudgetingPanel.tsx",
    forecasting: "client/src/ali-lab/features/ForecastingPanel.tsx",
    goals: "client/src/ali-lab/features/GoalsPanel.tsx",
    investments: "client/src/ali-lab/features/InvestmentsPanel.tsx",
    "bill-reminders": "client/src/ali-lab/features/BillRemindersPanel.tsx",
    drivePanel: "client/src/ali-lab/personal-plan/components/PersonalGoogleDrivePanel.tsx",
    statementUpload: "client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx",
  };
  const missing = Object.entries(featureFiles)
    .filter(([, p]) => !fs.existsSync(path.join(root, p)))
    .map(([k]) => k);
  step("personal_feature_surfaces", missing.length === 0, {
    checked: Object.keys(featureFiles),
    missing,
  });

  results.finishedAt = new Date().toISOString();
  results.summary = {
    passed: results.steps.filter((s) => s.ok).length,
    failed: results.steps.filter((s) => !s.ok).length,
    uid,
    incomeTotal,
    expenseTotal,
    savings: incomeTotal - expenseTotal,
  };
  writeResults();
  if (results.summary.failed > 0) process.exitCode = 1;
}

function writeResults() {
  const outDir = path.join(root, "fixtures/personal");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "e2e-results.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  step("fatal", false, { error: e instanceof Error ? e.message : String(e) });
  writeResults();
  process.exitCode = 1;
});
