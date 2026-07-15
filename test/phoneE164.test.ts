import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "../lib/phoneE164.js";

describe("normalizePhoneToE164", () => {
  it("converts Swiss local mobiles to +41", () => {
    expect(normalizePhoneToE164("0787575993")).toBe("+41787575993");
    expect(normalizePhoneToE164("078 757 59 93")).toBe("+41787575993");
  });

  it("keeps valid E.164", () => {
    expect(normalizePhoneToE164("+41787575993")).toBe("+41787575993");
  });

  it("returns null for empty", () => {
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164("   ")).toBeNull();
  });

  it("rejects invalid", () => {
    expect(() => normalizePhoneToE164("123")).toThrow(/E\.164/i);
  });
});
