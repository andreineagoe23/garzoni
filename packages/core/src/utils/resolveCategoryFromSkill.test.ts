import { describe, expect, it } from "vitest";
import { resolveCategoryFromSkill } from "./resolveCategoryFromSkill";

describe("resolveCategoryFromSkill", () => {
  const categories = [
    "Basic Finance",
    "Personal Finance",
    "Investing",
    "Forex",
    "Cryptocurrency",
    "Real Estate",
  ];

  it("maps known mastery keys to API categories (case-insensitive)", () => {
    expect(resolveCategoryFromSkill("investing", categories)).toBe("Investing");
    expect(resolveCategoryFromSkill("INVESTING", categories)).toBe("Investing");
  });

  it("uses explicit map when fuzzy match would be wrong", () => {
    expect(resolveCategoryFromSkill("forex", ["Forex", "Investing"])).toBe(
      "Forex",
    );
    expect(resolveCategoryFromSkill("budgeting", categories)).toBe(
      "Basic Finance",
    );
  });

  it("falls back to partial substring match", () => {
    expect(resolveCategoryFromSkill("invest", categories)).toBe("Investing");
  });

  it("returns empty string when nothing matches", () => {
    expect(resolveCategoryFromSkill("Quantum Physics", categories)).toBe("");
  });
});
