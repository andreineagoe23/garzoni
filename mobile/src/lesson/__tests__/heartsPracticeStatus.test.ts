import { heartsPracticeDisplayState } from "../heartsPracticeStatus";

describe("heartsPracticeDisplayState", () => {
  it("defaults to in-progress with 0 correct when no data is available yet", () => {
    expect(heartsPracticeDisplayState(null)).toEqual({
      kind: "inProgress",
      correctSoFar: 0,
      correctNeeded: 2,
      remaining: 2,
    });
    expect(heartsPracticeDisplayState(undefined)).toEqual({
      kind: "inProgress",
      correctSoFar: 0,
      correctNeeded: 2,
      remaining: 2,
    });
  });

  it("reports remaining correct answers needed while under the daily cap", () => {
    const result = heartsPracticeDisplayState({
      correct_needed: 2,
      correct_so_far: 1,
      granted_today: 0,
      daily_cap: 2,
    });
    expect(result).toEqual({
      kind: "inProgress",
      correctSoFar: 1,
      correctNeeded: 2,
      remaining: 1,
    });
  });

  it("reports 0 remaining right at the threshold (server will grant on the next correct answer)", () => {
    const result = heartsPracticeDisplayState({
      correct_needed: 2,
      correct_so_far: 2,
      granted_today: 0,
      daily_cap: 2,
    });
    expect(result).toEqual({
      kind: "inProgress",
      correctSoFar: 2,
      correctNeeded: 2,
      remaining: 0,
    });
  });

  it("switches to capReached once granted_today reaches daily_cap, even mid-progress", () => {
    const result = heartsPracticeDisplayState({
      correct_needed: 2,
      correct_so_far: 1,
      granted_today: 2,
      daily_cap: 2,
    });
    expect(result).toEqual({
      kind: "capReached",
      grantedToday: 2,
      dailyCap: 2,
    });
  });

  it("treats granted_today exceeding daily_cap as capped too (defensive)", () => {
    const result = heartsPracticeDisplayState({
      correct_needed: 2,
      correct_so_far: 0,
      granted_today: 3,
      daily_cap: 2,
    });
    expect(result.kind).toBe("capReached");
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
