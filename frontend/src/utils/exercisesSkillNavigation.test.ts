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
      exerciseId: null,
    });
  });

  it("supports weak_skill_practice and weak_skill_review reasons", () => {
    const p = getExercisesSkillNavigation("Budgeting", "weak_skill_practice");
    expect(p.state.reason).toBe("weak_skill_practice");
    const r = getExercisesSkillNavigation("Investing", "weak_skill_review", {
      exerciseId: 42,
    });
    expect(r.state.reason).toBe("weak_skill_review");
    expect(r.state.exerciseId).toBe(42);
    expect(r.search).toContain("exerciseId=42");
  });
});

describe("normalizeExercisesSkillReason", () => {
  it("maps legacy improve_weak_skill to weak_skill_practice", () => {
    expect(normalizeExercisesSkillReason("improve_weak_skill")).toBe(
      "weak_skill_practice"
    );
  });

  it("maps legacy quick_card_exercises to weak_skill_practice", () => {
    expect(normalizeExercisesSkillReason("quick_card_exercises")).toBe(
      "weak_skill_practice"
    );
  });
});
