import { resolveCategoryFromSkill } from "./resolveCategoryFromSkill";

describe("resolveCategoryFromSkill", () => {
  const categories = ["Investing", "Budgeting", "Basic Finance"];

  it("returns exact API category name (case-insensitive)", () => {
    expect(resolveCategoryFromSkill("investing", categories)).toBe("Investing");
    expect(resolveCategoryFromSkill("INVESTING", categories)).toBe("Investing");
  });

  it("maps configured mastery slug to API category", () => {
    expect(resolveCategoryFromSkill("forex", ["Forex", "Investing"])).toBe(
      "Forex"
    );
    expect(resolveCategoryFromSkill("budgeting", categories)).toBe(
      "Basic Finance"
    );
  });

  it("matches partial skill to category substring", () => {
    expect(resolveCategoryFromSkill("invest", categories)).toBe("Investing");
  });

  it("returns empty string when no match", () => {
    expect(resolveCategoryFromSkill("Quantum Physics", categories)).toBe("");
  });
});
