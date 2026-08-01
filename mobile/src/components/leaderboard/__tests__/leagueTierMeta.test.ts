import {
  LEAGUE_TIER_ORDER,
  leagueTierColor,
  leagueTierNameKey,
} from "../leagueTierMeta";

describe("leagueTierColor", () => {
  test("returns a distinct colour for each known tier", () => {
    const colors = LEAGUE_TIER_ORDER.map(leagueTierColor);
    expect(new Set(colors).size).toBe(LEAGUE_TIER_ORDER.length);
  });

  test("falls back to bronze for an unknown tier", () => {
    expect(leagueTierColor("unknown")).toBe(leagueTierColor("bronze"));
  });
});

describe("leagueTierNameKey", () => {
  test("builds the i18n key for each known tier", () => {
    expect(leagueTierNameKey("bronze")).toBe(
      "leaderboard.leagues.tierName.bronze",
    );
    expect(leagueTierNameKey("diamond")).toBe(
      "leaderboard.leagues.tierName.diamond",
    );
  });

  test("falls back to bronze for an unknown tier", () => {
    expect(leagueTierNameKey("platinum")).toBe(
      "leaderboard.leagues.tierName.bronze",
    );
  });
});
