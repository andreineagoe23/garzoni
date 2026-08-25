import { describe, expect, it } from "vitest";
import {
  countdownLabel,
  getMissionPresentation,
  msUntilDailyReset,
  msUntilWeeklyReset,
  resolveQuestStepRoute,
} from "./missionPresentation";

describe("getMissionPresentation", () => {
  it("turns lesson percent into a count against the mission's own target", () => {
    const p = getMissionPresentation(
      {
        id: 1,
        goal_type: "complete_lesson",
        progress: 50,
        goal_reference: { required_lessons: 2 },
      },
      { isDaily: true },
    );
    expect(p.progressKey).toBe("missions.progress.fraction.lessons");
    expect(p.progressParams).toEqual({ current: 1, total: 2 });
    expect(p.actionKind).toBe("route");
  });

  it("falls back to the level-aware lesson requirement", () => {
    const p = getMissionPresentation(
      { id: 1, goal_type: "complete_lesson", progress: 0 },
      { isDaily: true, lessonRequirement: 3 },
    );
    expect(p.progressParams).toEqual({ current: 0, total: 3 });
  });

  it("never rounds a partial step up to a finished one", () => {
    const p = getMissionPresentation(
      {
        id: 1,
        goal_type: "complete_lesson",
        progress: 66,
        goal_reference: { required_lessons: 3 },
      },
      { isDaily: true },
    );
    expect(p.progressParams.current).toBe(1);
  });

  it("uses 5 facts for weekly and 1 for daily", () => {
    expect(
      getMissionPresentation(
        { id: 1, goal_type: "read_fact", progress: 40 },
        { isDaily: false },
      ).progressParams,
    ).toEqual({ current: 2, total: 5 });
    expect(
      getMissionPresentation(
        { id: 1, goal_type: "read_fact", progress: 0 },
        { isDaily: true },
      ).progressParams,
    ).toEqual({ current: 0, total: 1 });
  });

  it("routes savings and facts to in-app sheets, not navigation", () => {
    expect(
      getMissionPresentation(
        { id: 1, goal_type: "add_savings", progress: 0 },
        { isDaily: true },
      ).actionKind,
    ).toBe("savings");
    expect(
      getMissionPresentation(
        { id: 1, goal_type: "read_fact", progress: 0 },
        { isDaily: true },
      ).actionKind,
    ).toBe("fact");
  });

  it("clamps progress and degrades unknown goal types gracefully", () => {
    const p = getMissionPresentation(
      { id: 1, goal_type: "mystery", progress: 180 },
      { isDaily: true },
    );
    expect(p.percent).toBe(100);
    expect(p.actionKind).toBe("none");
    expect(p.ctaLabelKey).toBeNull();
  });
});

describe("resolveQuestStepRoute", () => {
  it("maps the seeded lesson step to a real destination on both platforms", () => {
    expect(
      resolveQuestStepRoute({
        id: "lesson-investing",
        type: "lesson",
        course_topic: "investing",
        route: "/all-topics?topic=investing",
      }),
    ).toEqual({
      web: "/all-topics?topic=investing",
      mobile: "/(tabs)/learn?view=personalized",
    });
  });

  it("carries the skill filter into both exercise routes", () => {
    const { web, mobile } = resolveQuestStepRoute({
      type: "exercise",
      exercise_category: "Investing",
    });
    expect(web).toBe("/exercises?skill=Investing&intentReason=mission_step");
    expect(mobile).toBe(
      "/(tabs)/exercises?skill=Investing&intentReason=mission_step",
    );
  });

  it("sends mobile to the tabbed tool route so the tab bar stays visible", () => {
    expect(
      resolveQuestStepRoute({ type: "tool", tool_slug: "budget-planner" }),
    ).toEqual({
      web: "/tools/budget-planner",
      mobile: "/(tabs)/tools/budget-planner",
    });
  });

  it("never invents a mobile destination for an unknown step type", () => {
    expect(resolveQuestStepRoute({ type: "chat", route: "/support" })).toEqual({
      web: "/support",
      mobile: null,
    });
    expect(resolveQuestStepRoute({ type: "chat" })).toEqual({
      web: null,
      mobile: null,
    });
  });

  it("ignores a stored route that isn't an app path", () => {
    expect(
      resolveQuestStepRoute({ type: "mystery", route: "https://example.com" })
        .web,
    ).toBeNull();
  });
});

describe("cycle countdowns", () => {
  it("counts to the next local midnight", () => {
    const now = new Date(2026, 7, 1, 21, 30, 0);
    expect(msUntilDailyReset(now)).toBe(2.5 * 60 * 60 * 1000);
  });

  it("counts to the next Monday, never zero on a Monday", () => {
    const monday = new Date(2026, 7, 3, 9, 0, 0);
    const ms = msUntilWeeklyReset(monday);
    expect(ms).toBe((7 * 24 - 9) * 60 * 60 * 1000);
  });

  it("picks the coarsest useful countdown unit", () => {
    expect(countdownLabel(50 * 60_000)).toEqual({
      key: "missions.reset.minutes",
      params: { minutes: 50 },
    });
    expect(countdownLabel(3 * 3_600_000 + 12 * 60_000)).toEqual({
      key: "missions.reset.hours",
      params: { hours: 3, minutes: 12 },
    });
    expect(countdownLabel(2 * 86_400_000 + 3_600_000)).toEqual({
      key: "missions.reset.days",
      params: { days: 2, hours: 1 },
    });
  });
});
