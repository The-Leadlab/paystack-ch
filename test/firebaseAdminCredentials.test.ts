import { describe, expect, it } from "vitest";
import {
  normalizeServiceAccountPrivateKey,
  parseServiceAccountJson,
} from "../lib/firebaseAdmin.js";

describe("firebaseAdmin credentials", () => {
  it("re-wraps single-line PEM private keys", () => {
    const body = "MIIE".padEnd(68, "x");
    const oneLine = `-----BEGIN PRIVATE KEY-----${body}-----END PRIVATE KEY-----`;
    const fixed = normalizeServiceAccountPrivateKey(oneLine);
    expect(fixed).toContain("-----BEGIN PRIVATE KEY-----\n");
    expect(fixed).toContain("\n-----END PRIVATE KEY-----\n");
    expect(fixed).not.toBe(oneLine);
  });

  it("parses JSON with escaped newlines in private_key", () => {
    const json = JSON.stringify({
      type: "service_account",
      project_id: "paystack-ch",
      private_key:
        "-----BEGIN PRIVATE KEY-----\\nMIIExQIBADKCAQEAabc\\n-----END PRIVATE KEY-----\\n",
      client_email: "firebase-adminsdk@test.iam.gserviceaccount.com",
    });
    const cred = parseServiceAccountJson(json);
    expect(cred.private_key).toContain("\n-----END PRIVATE KEY-----\n");
  });
});
