import { describe, expect, it } from "vitest";
import { heartsPracticeDisplayState } from "./heartsPracticeStatus";

describe("heartsPracticeDisplayState", () => {
  it("defaults to in-progress with 0 correct when no data is available yet", () => {
    expect(heartsPracticeDisplayState(null)).toEqual({
      kind: "inProgress",
      correctSoFar: 0,
      correctNeeded: 2,
      remaining: 2,
    });
  });

  it("reports remaining correct answers needed while under the daily cap", () => {
    expect(
      heartsPracticeDisplayState({
        correct_needed: 2,
        correct_so_far: 1,
        granted_today: 0,
        daily_cap: 2,
      })
    ).toEqual({
      kind: "inProgress",
      correctSoFar: 1,
      correctNeeded: 2,
      remaining: 1,
    });
  });

  it("switches to capReached once granted_today reaches daily_cap", () => {
    expect(
      heartsPracticeDisplayState({
        correct_needed: 2,
        correct_so_far: 1,
        granted_today: 2,
        daily_cap: 2,
      })
    ).toEqual({ kind: "capReached", grantedToday: 2, dailyCap: 2 });
  });

  it("clamps negative/garbage counters instead of throwing", () => {
    const result = heartsPracticeDisplayState({
      correct_needed: -5,
      correct_so_far: -1,
      granted_today: -1,
      daily_cap: 2,
    });
    expect(result).toEqual({
      kind: "inProgress",
      correctSoFar: 0,
      correctNeeded: 1,
      remaining: 1,
    });
  });
});
