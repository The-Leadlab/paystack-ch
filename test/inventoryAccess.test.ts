import { describe, expect, it } from "vitest";
import {
  INVENTORY_DEV_EMAILS,
  isInventoryAllowedForUser,
} from "../shared/inventoryAccess";

describe("isInventoryAllowedForUser", () => {
  it("allows Ali, Damien, and Louise on the built-in list", () => {
    for (const email of INVENTORY_DEV_EMAILS) {
      expect(isInventoryAllowedForUser(email)).toBe(true);
    }
    expect(isInventoryAllowedForUser("louise@the-leadlab.com")).toBe(true);
  });

  it("unlocks anyone on UK UAT (GBP sandbox)", () => {
    expect(isInventoryAllowedForUser("anyone@cafe.uk", { ukUatActive: true })).toBe(true);
    expect(isInventoryAllowedForUser("louise@test.com", { ukUatActive: true })).toBe(true);
  });

  it("honours extraEmails, beta, admin, and env master switch", () => {
    expect(
      isInventoryAllowedForUser("louise@paystack.ch", {
        extraEmails: ["louise@paystack.ch"],
      }),
    ).toBe(true);
    expect(isInventoryAllowedForUser("beta@test.com", { inventoryBeta: true })).toBe(true);
    expect(isInventoryAllowedForUser("admin@test.com", { adminAppAccess: true })).toBe(true);
    expect(isInventoryAllowedForUser("anyone@test.com", { envEnabled: true })).toBe(true);
  });

  it("denies ordinary CHF users without opts", () => {
    expect(isInventoryAllowedForUser("other@test.com")).toBe(false);
    expect(isInventoryAllowedForUser("louise@paystack.ch")).toBe(false);
    expect(isInventoryAllowedForUser(null)).toBe(false);
  });
});
