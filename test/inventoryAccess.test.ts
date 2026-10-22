import { describe, expect, it } from "vitest";
import { isInventoryAllowedForUser, isInventoryEnabled } from "../shared/inventoryAccess";

describe("isInventoryEnabled", () => {
  it("respects an explicit env override", () => {
    expect(isInventoryEnabled(true)).toBe(true);
    expect(isInventoryEnabled(false)).toBe(false);
  });
});

describe("isInventoryAllowedForUser extras", () => {
  it("requires a matching extra email", () => {
    expect(
      isInventoryAllowedForUser("other@test.com", { extraEmails: ["louise@paystack.ch"] })
    ).toBe(false);
  });
});
