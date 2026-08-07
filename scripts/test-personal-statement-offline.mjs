/**
 * Offline personal statement + Drive-path checks (no Firebase Admin required).
 * Usage: node scripts/test-personal-statement-offline.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csvPath = path.join(root, "fixtures/personal/ali-bank-statement-2026-07.csv");
const pdfPath = path.join(root, "fixtures/personal/ali-bank-statement-2026-07.pdf");

const results = {
  startedAt: new Date().toISOString(),
  email: "ali@the-leadlab.com",
  mode: "offline",
  steps: [],
};

function step(name, ok, detail = {}) {
  results.steps.push({ name, ok, ...detail, at: new Date().toISOString() });
  console.log(ok ? "OK " : "FAIL", name, detail.error || detail.message || JSON.stringify(detail));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    const [date, description, amountRaw] = line.split(",");
    const amount = Number(amountRaw);
    if (!date || !description || !Number.isFinite(amount) || amount === 0) continue;
    const kind = amount < 0 ? "expense" : "income";
    const d = description.toLowerCase();
    let expenseCat = "SHOPPING_OTHER";
    let incomeCat = "SALARY";
    if (d.includes("salary")) incomeCat = "SALARY";
    else if (d.includes("dividend")) incomeCat = "ASSET_REVENUE";
    else if (d.includes("gift") || d.includes("contribution")) incomeCat = "CONTRIBUTIONS";
    if (d.includes("migros") || d.includes("coop")) expenseCat = "GROCERIES";
    else if (d.includes("rent")) expenseCat = "RENT";
    else if (d.includes("swisscom") || d.includes("serafe")) expenseCat = "BILLS";
    else if (d.includes("uber")) expenseCat = "GOING_OUT";
    else if (d.includes("pillar") || d.includes("viac")) expenseCat = "SAVINGS_INVEST";
    rows.push({
      date: date.trim(),
      description: description.trim(),
      amount: Math.abs(amount),
      kind,
      expenseCat,
      incomeCat,
    });
  }
  return rows;
}

const csvOk = fs.existsSync(csvPath);
const pdfOk = fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 500;
step("fixtures_csv", csvOk, { path: csvPath });
step("fixtures_pdf", pdfOk, { path: pdfPath, bytes: pdfOk ? fs.statSync(pdfPath).size : 0 });

let incomeTotal = 0;
let expenseTotal = 0;
let rows = [];
if (csvOk) {
  rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  incomeTotal = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  expenseTotal = rows.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
  step("csv_parse", rows.length === 10, {
    rowCount: rows.length,
    incomeTotal,
    expenseTotal,
    savings: Math.round((incomeTotal - expenseTotal) * 100) / 100,
  });
  step("category_mapping", rows.some((r) => r.expenseCat === "RENT") && rows.some((r) => r.incomeCat === "SALARY"), {
    sample: rows.slice(0, 3),
  });
}

const featureFiles = {
  overview: "client/src/ali-lab/features/PersonalDashboardPanel.tsx",
  budgeting: "client/src/ali-lab/features/BudgetingPanel.tsx",
  forecasting: "client/src/ali-lab/features/ForecastingPanel.tsx",
  goals: "client/src/ali-lab/features/GoalsPanel.tsx",
  investments: "client/src/ali-lab/features/InvestmentsPanel.tsx",
  "bill-reminders": "client/src/ali-lab/features/BillRemindersPanel.tsx",
  drivePanel: "client/src/ali-lab/personal-plan/components/PersonalGoogleDrivePanel.tsx",
  statementUpload: "client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx",
  driveBackup: "client/src/ali-lab/lib/personalStatementDriveBackup.ts",
  googleServicesPersonal: "lib/googleServices.ts",
};
const missing = Object.entries(featureFiles)
  .filter(([, p]) => !fs.existsSync(path.join(root, p)))
  .map(([k]) => k);
step("personal_feature_surfaces", missing.length === 0, { checked: Object.keys(featureFiles), missing });

const gs = fs.readFileSync(path.join(root, "lib/googleServices.ts"), "utf8");
step("drive_personal_folder_code", gs.includes('GOOGLE_DRIVE_PERSONAL_FOLDER_NAME = "Personal"') && gs.includes("computePersonalDateFolderName"), {
  message: "Paystack Documents / Personal / YYYY-MM-DD wiring present",
});

const upload = fs.readFileSync(
  path.join(root, "client/src/ali-lab/personal-plan/components/PersonalStatementUpload.tsx"),
  "utf8"
);
step("upload_triggers_drive_backup", upload.includes("backupPersonalStatementToGoogleDrive"), {
  message: "Statement commit triggers personal Drive backup",
});

const dash = fs.readFileSync(path.join(root, "client/src/ali-lab/features/PersonalDashboardPanel.tsx"), "utf8");
step("overview_shows_drive_panel", dash.includes("PersonalGoogleDrivePanel"), {
  message: "Overview includes Google Drive connect for personal",
});

// Env readiness (no secret values)
const envText = fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8") : "";
const adminLine = envText.split(/\r?\n/).find((l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64="));
const adminLen = adminLine ? adminLine.length - "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=".length : 0;
step("firebase_admin_ready", adminLen > 100, {
  message:
    adminLen > 100
      ? "Admin credentials present — run npx tsx scripts/seed-personal-ali-e2e.mjs to write ali@ ledger"
      : "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is empty/placeholder — cannot seed ali@ Firestore from this machine",
  credentialLength: adminLen,
});

results.finishedAt = new Date().toISOString();
results.summary = {
  passed: results.steps.filter((s) => s.ok).length,
  failed: results.steps.filter((s) => !s.ok).length,
  incomeTotal,
  expenseTotal,
  savings: Math.round((incomeTotal - expenseTotal) * 100) / 100,
  rowCount: rows.length,
  driveTree: "Paystack Documents / Personal / YYYY-MM-DD / <file>",
  manualNext: [
    "Sign in as ali@the-leadlab.com at /personal/overview",
    "Connect Google Drive (creates Personal folder on first upload)",
    "Upload fixtures/personal/ali-bank-statement-2026-07.pdf",
    "Or fill FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 and re-run seed script",
  ],
};

const out = path.join(root, "fixtures/personal/e2e-results.json");
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log("Wrote", out);
console.log("Summary", results.summary);
if (results.summary.failed > 0) process.exitCode = 1;
