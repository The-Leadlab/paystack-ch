import { describe, expect, it } from "vitest";
import {
  issuerLooksLikeOwnBusiness,
  normalizeBusinessName,
} from "../client/src/cafe/lib/ownBusinessIdentity";

describe("ownBusinessIdentity", () => {
  it("matches issuer to Invoice Maker company name", () => {
    expect(
      issuerLooksLikeOwnBusiness("Brownley Lane Motors", ["Brownley Lane Motors MOT Centre"])
    ).toBe(true);
    expect(issuerLooksLikeOwnBusiness("Transgourmet", ["Brownley Lane Motors"])).toBe(false);
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeBusinessName("Café de la Place")).toBe("cafe de la place");
    expect(issuerLooksLikeOwnBusiness("Cafe de la Place SA", ["Café de la Place"])).toBe(true);
  });
});
