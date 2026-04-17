import { selectPrimaryCTA } from "@garzoni/core";

describe("selectPrimaryCTA", () => {
  it("prefers reviews when any are due", () => {
    const result = selectPrimaryCTA({ reviewsDue: 2, activeMissions: [] });
    expect(result.type).toBe("reviews_due");
    expect(result.reasonKey).toBe("cta.reviewsDue");
    expect(result.reasonCount).toBe(2);
  });

  it("returns continue lesson when a lesson mission is active", () => {
    const mission = { id: 1, goal_type: "complete_lesson" };
    const result = selectPrimaryCTA({
      reviewsDue: 0,
      activeMissions: [mission],
    });
    expect(result.type).toBe("continue_lesson");
    expect(result.mission).toBe(mission);
  });

  it("returns start mission when only non-lesson missions are active", () => {
    const result = selectPrimaryCTA({
      reviewsDue: 0,
      activeMissions: [{ id: 2, goal_type: "complete_quiz" }],
    });
    expect(result.type).toBe("start_mission");
    expect(result.reasonKey).toBe("cta.activeMissions");
    expect(result.reasonCount).toBe(1);
  });

  it("defaults to continue learning when no reviews or missions", () => {
    const result = selectPrimaryCTA({ reviewsDue: 0, activeMissions: [] });
    expect(result.type).toBe("continue_learning");
  });

  it("omitReviewsDue skips reviews branch so missions can win", () => {
    const result = selectPrimaryCTA(
      {
        reviewsDue: 3,
        activeMissions: [{ id: 2, goal_type: "complete_quiz" }],
      },
      { omitReviewsDue: true }
    );
    expect(result.type).toBe("start_mission");
    expect(result.reasonCount).toBe(1);
  });

  it("omitReviewsDue with only reviews falls through to continue learning", () => {
    const result = selectPrimaryCTA(
      { reviewsDue: 2, activeMissions: [] },
      { omitReviewsDue: true }
    );
    expect(result.type).toBe("continue_learning");
  });
});
