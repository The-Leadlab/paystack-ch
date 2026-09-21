import { describe, expect, it } from "vitest";
import { redactSensitive } from "../lib/redactSensitive.js";

describe("redactSensitive", () => {
  it("masks password and authorization fields in nested cache payloads", () => {
    const redacted = redactSensitive({
      url: "/api/admin/verify",
      body: { password: "ali123*", remember: true },
      headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" },
      nested: [{ refresh_token: "abc", fileName: "invoice.pdf" }],
    });
    expect(redacted.body.password).toBe("[redacted]");
    expect(redacted.headers.Authorization).toBe("[redacted]");
    expect(redacted.nested[0].refresh_token).toBe("[redacted]");
    expect(redacted.nested[0].fileName).toBe("invoice.pdf");
    expect(redacted.body.remember).toBe(true);
  });

  it("masks secrets in query strings", () => {
    expect(redactSensitive("https://app.example/login?password=hunter2&next=/admin")).toContain(
      "password=[redacted]"
    );
  });
});
