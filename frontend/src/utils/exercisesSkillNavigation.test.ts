import {
  getExercisesSkillNavigation,
  normalizeExercisesSkillReason,
} from "./exercisesSkillNavigation";

describe("getExercisesSkillNavigation", () => {
  it("encodes skill in search and passes dashboard state", () => {
    const skill = "Real Estate";
    const nav = getExercisesSkillNavigation(skill, "weak_skill_click");
    expect(nav.pathname).toBe("/exercises");
    expect(nav.search).toBe(`?skill=${encodeURIComponent(skill)}`);
    expect(nav.state).toEqual({
      from: "dashboard",
      targetSkill: skill,
      reason: "weak_skill_click",
    });
  });

  it("supports weak_skill_practice and quick_card_exercises reasons", () => {
    const p = getExercisesSkillNavigation("Budgeting", "weak_skill_practice");
    expect(p.state.reason).toBe("weak_skill_practice");
    const q = getExercisesSkillNavigation("Investing", "quick_card_exercises");
    expect(q.state.reason).toBe("quick_card_exercises");
  });
});

describe("normalizeExercisesSkillReason", () => {
  it("maps legacy improve_weak_skill to weak_skill_practice", () => {
    expect(normalizeExercisesSkillReason("improve_weak_skill")).toBe(
      "weak_skill_practice"
    );
  });
});
