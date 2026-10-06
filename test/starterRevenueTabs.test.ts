import { describe, expect, it } from "vitest";
import { entitlementsForPlan } from "../shared/planCatalog.js";

describe("Starter plan Revenue/Expenses tabs", () => {
  it("grants basicReportsAndExports so Revenue and Expenses stay visible", () => {
    const starter = entitlementsForPlan("starter");
    expect(starter.basicReportsAndExports).toBe(true);
    // Business keeps advanced reports; Starter does not need them for tab visibility
    expect(starter.allCoreModules).toBe(false);
  });
});
