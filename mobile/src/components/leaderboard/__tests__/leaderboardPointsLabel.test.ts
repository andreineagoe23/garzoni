import {
  resolveDisplayXp,
  leaderboardPointsLabel,
} from "../leaderboardPointsLabel";

const t = (key: string, opts?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(opts ?? {})}`;
const formatPoints = (n: number) => String(n);

describe("resolveDisplayXp", () => {
  it("uses xp_window on week", () => {
    expect(resolveDisplayXp({ points: 500, xp_window: 120 }, "week")).toBe(
      120,
    );
  });

  it("uses xp_window on month", () => {
    expect(resolveDisplayXp({ points: 500, xp_window: 300 }, "month")).toBe(
      300,
    );
  });

  it("falls back to points on week when xp_window is missing", () => {
    expect(resolveDisplayXp({ points: 500 }, "week")).toBe(500);
  });

  it("uses lifetime points on all-time regardless of xp_window", () => {
    expect(
      resolveDisplayXp({ points: 500, xp_window: 120 }, "all-time"),
    ).toBe(500);
  });
});

describe("leaderboardPointsLabel", () => {
  it("uses the windowed copy key on week", () => {
    expect(
      leaderboardPointsLabel(t, formatPoints, { points: 500, xp_window: 120 }, "week"),
    ).toBe('leaderboard.pointsWindow.week:{"points":"120"}');
  });

  it("uses the windowed copy key on month", () => {
    expect(
      leaderboardPointsLabel(
        t,
        formatPoints,
        { points: 500, xp_window: 300 },
        "month",
      ),
    ).toBe('leaderboard.pointsWindow.month:{"points":"300"}');
  });

  it("keeps the original copy key unchanged on all-time", () => {
    expect(
      leaderboardPointsLabel(t, formatPoints, { points: 500 }, "all-time"),
    ).toBe('leaderboard.points:{"points":"500"}');
  });
});
