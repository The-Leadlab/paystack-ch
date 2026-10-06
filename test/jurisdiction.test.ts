import { describe, expect, it } from "vitest";
import {
  currencyFromIncorporation,
  parseJurisdictionCountry,
  resolveIncorporationCountryFromUserDoc,
  resolveTaxRegion,
  taxRegionFromIncorporation,
} from "../shared/jurisdiction.js";

describe("jurisdiction", () => {
  it("enables UK incorporation with GBP and UK VAT rates", () => {
    expect(parseJurisdictionCountry("gb")).toBe("gb");
    expect(taxRegionFromIncorporation("gb")).toBe("uk");
    expect(currencyFromIncorporation("gb")).toBe("GBP");
    expect(resolveTaxRegion({ incorporationCountry: "gb" })).toBe("uk");
  });

  it("keeps Switzerland as the default ready region", () => {
    expect(parseJurisdictionCountry("nope")).toBe("ch");
    expect(taxRegionFromIncorporation("ch")).toBe("ch");
    expect(currencyFromIncorporation("ch")).toBe("CHF");
  });

  it("prefers an explicit tax region override", () => {
    expect(resolveTaxRegion({ taxRegion: "uk", incorporationCountry: "ch" })).toBe("uk");
  });

  it("loads incorporation country without flipping CH docs to UK", () => {
    expect(resolveIncorporationCountryFromUserDoc({ incorporationCountry: "ch" })).toBe("ch");
    expect(resolveIncorporationCountryFromUserDoc({ incorporationCountry: "gb" })).toBe("gb");
    expect(resolveIncorporationCountryFromUserDoc({})).toBe("ch");
    expect(resolveIncorporationCountryFromUserDoc({ taxRegion: "uk" })).toBe("gb");
    expect(
      resolveIncorporationCountryFromUserDoc({
        incorporationCountry: "ch",
        taxRegion: "uk",
      })
    ).toBe("ch");
  });
});
