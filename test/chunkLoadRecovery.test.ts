import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../client/src/lib/chunkLoadRecovery";

describe("isChunkLoadError", () => {
  it("matches Chrome / Edge wording", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://www.paystack.ch/assets/PlatformPage-DSzaXsWA.js"
        )
      )
    ).toBe(true);
  });

  it("matches Firefox wording", () => {
    expect(
      isChunkLoadError(
        new TypeError("error loading dynamically imported module: https://example.com/a.js")
      )
    ).toBe(true);
  });

  it("matches Safari wording", () => {
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
