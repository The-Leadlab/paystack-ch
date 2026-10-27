import { describe, expect, it } from "vitest";
import {
  INVENTORY_DEV_EMAILS,
  isInventoryAllowedForUser,
} from "../shared/inventoryAccess";

describe("isInventoryAllowedForUser", () => {
  it("allows only Ali and Damien", () => {
    for (const email of INVENTORY_DEV_EMAILS) {
      expect(isInventoryAllowedForUser(email)).toBe(true);
    }
  });

  it("denies everyone else even with legacy unlock opts", () => {
    expect(
      isInventoryAllowedForUser("other@test.com", {
        envEnabled: true,
        inventoryBeta: true,
        ukUatActive: true,
        adminAppAccess: true,
        extraEmails: ["louise@paystack.ch"],
      }),
    ).toBe(false);
    expect(isInventoryAllowedForUser("louise@paystack.ch")).toBe(false);
  });
});
