import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const secretPatterns = [
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: "Google OAuth token", regex: /ya29\.[0-9A-Za-z._-]+/g },
  { name: "Google OAuth client secret", regex: /GOCSPX-[0-9A-Za-z_-]+/g },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { name: "Stripe live secret key", regex: /sk_live_[0-9A-Za-z]+/g },
  { name: "Stripe webhook secret", regex: /whsec_[0-9A-Za-z]+/g },
];

const allowedPlaceholder = /(your_|example|placeholder|\.\.\.|xxx|test_|sk_test_|pk_test_)/i;
const ignoredPaths = /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => !ignoredPaths.test(path));

const findings = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of secretPatterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0];
      if (allowedPlaceholder.test(value)) continue;
      findings.push({ file, type: pattern.name });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.type}`);
  }
  process.exit(1);
}

console.log("Security scan passed: no high-confidence committed secrets found.");
