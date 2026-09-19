import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "../lib/phoneE164.js";

describe("normalizePhoneToE164", () => {
  it("converts Swiss local mobiles to +41", () => {
    expect(normalizePhoneToE164("0765432111")).toBe("+41765432111");
    expect(normalizePhoneToE164("076 543 21 11")).toBe("+41765432111");
  });

  it("keeps valid E.164", () => {
    expect(normalizePhoneToE164("+41765432111")).toBe("+41765432111");
  });

  it("returns null for empty", () => {
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164("   ")).toBeNull();
  });

  it("rejects invalid", () => {
    expect(() => normalizePhoneToE164("123")).toThrow(/E\.164/i);
  });
});
