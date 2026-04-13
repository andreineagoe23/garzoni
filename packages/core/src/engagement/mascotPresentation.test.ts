import { describe, expect, it } from "vitest";
import {
  MASCOT_SITUATIONS,
  resolveMascotPresentation,
} from "./mascotPresentation";

describe("resolveMascotPresentation", () => {
  it("resolves every known situation with a non-empty key list", () => {
    for (const situation of MASCOT_SITUATIONS) {
      const r = resolveMascotPresentation(situation);
      expect(r.messagePoolKeys.length).toBeGreaterThan(0);
      expect(["neutral", "celebrate", "encourage"]).toContain(r.mood);
    }
  });

  it("maps attempt outcomes to expected moods", () => {
    expect(resolveMascotPresentation("lesson_exercise_correct").mood).toBe(
      "celebrate",
    );
    expect(resolveMascotPresentation("lesson_exercise_incorrect").mood).toBe(
      "encourage",
    );
    expect(resolveMascotPresentation("practice_correct").mood).toBe(
      "celebrate",
    );
    expect(resolveMascotPresentation("practice_incorrect").mood).toBe(
      "encourage",
    );
    expect(resolveMascotPresentation("quiz_incorrect").mood).toBe("encourage");
    expect(resolveMascotPresentation("quiz_complete").mood).toBe("celebrate");
  });

  it("pins bear for neutral reading / practice hub contexts", () => {
    expect(resolveMascotPresentation("lesson_reading").fixedMascot).toBe(
      "bear",
    );
    expect(resolveMascotPresentation("practice_neutral").fixedMascot).toBe(
      "bear",
    );
    expect(
      resolveMascotPresentation("missions_wrapup_progress").fixedMascot,
    ).toBe("bear");
  });

  it("does not fix mascot for celebrate / encourage quiz correct", () => {
    const r = resolveMascotPresentation("quiz_correct");
    expect(r.fixedMascot).toBeUndefined();
    expect(r.mood).toBe("celebrate");
  });
});
