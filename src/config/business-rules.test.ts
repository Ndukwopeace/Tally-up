/**
 * Tests that the business-rules config matches REQUIREMENTS.md §11 exactly.
 *
 * WHY: These values are owner decisions. A change here without a matching
 *      decision-log entry would silently change company policy (CLAUDE.md rule 4).
 */
import { describe, expect, it } from "vitest";

import { BUSINESS_RULES } from "./business-rules";

describe("BUSINESS_RULES match REQUIREMENTS §11", () => {
  it("defines 'today' in Douala time (Q-6, NFR-10)", () => {
    expect(BUSINESS_RULES.businessTimeZone).toBe("Africa/Douala");
  });

  it("uses Loaf as the base unit (PRD-04)", () => {
    expect(BUSINESS_RULES.baseUnit).toBe("Loaf");
  });

  it("does not allow decimal quantities (Q-20)", () => {
    expect(BUSINESS_RULES.allowDecimalQuantities).toBe(false);
  });

  it("numbers collections COL-00001 style", () => {
    expect(BUSINESS_RULES.collectionNumberFormat).toEqual({ prefix: "COL-", digits: 5 });
  });

  it("numbers hand-overs DIS-00001 style (Q-39)", () => {
    expect(BUSINESS_RULES.distributionNumberFormat).toEqual({ prefix: "DIS-", digits: 5 });
  });

  it("flags In Progress collections to Admin after 24 hours (COL-11)", () => {
    expect(BUSINESS_RULES.staleCollectionHours).toBe(24);
  });

  it("flags a receipt Awaiting Confirmation to Admin after 24 hours (Q-59f, RCP-15)", () => {
    expect(BUSINESS_RULES.agedReceiptHours).toBe(24);
  });

  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(BUSINESS_RULES)).toBe(true);
  });
});
