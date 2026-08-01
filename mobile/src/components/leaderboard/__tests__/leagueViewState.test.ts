import type { LeagueCurrentResponse } from "@garzoni/core";
import { deriveLeagueViewState, isLeaguesEnabled } from "../leagueViewState";

const ACTIVE: LeagueCurrentResponse = {
  enabled: true,
  assigned: true,
  tier: "gold",
  cycle_id: "2026-W30",
  league_id: 1,
  own_rank: 3,
  standings: [],
};

const UNASSIGNED: LeagueCurrentResponse = {
  enabled: true,
  assigned: false,
  cycle_id: "2026-W30",
};

const DISABLED: LeagueCurrentResponse = { enabled: false };

describe("deriveLeagueViewState", () => {
  test("loading takes priority while pending, even with stale data", () => {
    expect(
      deriveLeagueViewState({ isPending: true, isError: false, data: ACTIVE }),
    ).toBe("loading");
  });

  test("loading when there is no data yet, even if not marked pending", () => {
    expect(
      deriveLeagueViewState({
        isPending: false,
        isError: false,
        data: undefined,
      }),
    ).toBe("loading");
  });

  test("error takes priority over everything else", () => {
    expect(
      deriveLeagueViewState({ isPending: true, isError: true, data: ACTIVE }),
    ).toBe("error");
  });

  test("disabled when the backend reports leagues disabled", () => {
    expect(
      deriveLeagueViewState({
        isPending: false,
        isError: false,
        data: DISABLED,
      }),
    ).toBe("disabled");
  });

  test("unassigned when enabled but the user has no cohort this cycle", () => {
    expect(
      deriveLeagueViewState({
        isPending: false,
        isError: false,
        data: UNASSIGNED,
      }),
    ).toBe("unassigned");
  });

  test("active when enabled and assigned", () => {
    expect(
      deriveLeagueViewState({ isPending: false, isError: false, data: ACTIVE }),
    ).toBe("active");
  });
});

describe("isLeaguesEnabled", () => {
  test("false while there is no data yet", () => {
    expect(isLeaguesEnabled(undefined)).toBe(false);
  });

  test("false when the backend reports disabled", () => {
    expect(isLeaguesEnabled(DISABLED)).toBe(false);
  });

  test("true for both unassigned and active enabled responses", () => {
    expect(isLeaguesEnabled(UNASSIGNED)).toBe(true);
    expect(isLeaguesEnabled(ACTIVE)).toBe(true);
  });
});
