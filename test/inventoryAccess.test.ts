import { describe, expect, it } from "vitest";
import {
  INVENTORY_DEV_EMAILS,
  isInventoryAllowedForUser,
  isInventoryEnabled,
} from "../shared/inventoryAccess";

describe("isInventoryEnabled", () => {
  it("respects an explicit env override", () => {
    expect(isInventoryEnabled(true)).toBe(true);
    expect(isInventoryEnabled(false)).toBe(false);
  });
});

describe("isInventoryAllowedForUser", () => {
  it("allows Ali and Damien built-in emails without env flag", () => {
    for (const email of INVENTORY_DEV_EMAILS) {
      expect(isInventoryAllowedForUser(email, { envEnabled: false })).toBe(true);
    }
  });

  it("denies unrelated emails when env is off", () => {
    expect(
      isInventoryAllowedForUser("other@test.com", {
        envEnabled: false,
        extraEmails: ["louise@paystack.ch"],
      })
    ).toBe(false);
  });
});
