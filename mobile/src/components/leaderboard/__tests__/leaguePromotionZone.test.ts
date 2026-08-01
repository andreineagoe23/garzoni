import {
  DEMOTE_COUNT,
  MIN_COHORT_FOR_PROMOTION,
  PROMOTE_COUNT,
  isCohortEligibleForPromotion,
  leaguePromotionZoneForRank,
} from "../leaguePromotionZone";

describe("leaguePromotionZoneForRank", () => {
  test("below the promotion floor, every rank holds", () => {
    for (let rank = 1; rank <= 9; rank++) {
      expect(leaguePromotionZoneForRank(rank, 9)).toBe("hold");
    }
    expect(leaguePromotionZoneForRank(1, 1)).toBe("hold");
    expect(leaguePromotionZoneForRank(3, 3)).toBe("hold");
  });

  test("exactly at the floor, top 5 promote and bottom 5 demote with nobody held", () => {
    const total = MIN_COHORT_FOR_PROMOTION; // 10
    expect(leaguePromotionZoneForRank(1, total)).toBe("promote");
    expect(leaguePromotionZoneForRank(5, total)).toBe("promote");
    expect(leaguePromotionZoneForRank(6, total)).toBe("demote");
    expect(leaguePromotionZoneForRank(10, total)).toBe("demote");
  });

  test("a mid-sized cohort has a held middle band", () => {
    const total = 15;
    expect(leaguePromotionZoneForRank(1, total)).toBe("promote");
    expect(leaguePromotionZoneForRank(5, total)).toBe("promote");
    expect(leaguePromotionZoneForRank(6, total)).toBe("hold");
    expect(leaguePromotionZoneForRank(10, total)).toBe("hold");
    expect(leaguePromotionZoneForRank(11, total)).toBe("demote");
    expect(leaguePromotionZoneForRank(15, total)).toBe("demote");
  });

  test("clamps promote+demote so they never exceed the cohort size", () => {
    // total=11: promoteN=min(5,11)=5, demoteN=min(5, 11-5)=5 -> rank 6 holds
    const total = 11;
    expect(leaguePromotionZoneForRank(6, total)).toBe("hold");
    expect(leaguePromotionZoneForRank(7, total)).toBe("demote");
  });

  test("rank 1 always promotes once eligible, regardless of cohort size", () => {
    expect(leaguePromotionZoneForRank(1, MIN_COHORT_FOR_PROMOTION)).toBe(
      "promote",
    );
    expect(leaguePromotionZoneForRank(1, 30)).toBe("promote");
  });

  test("exports match the documented backend constants", () => {
    expect(MIN_COHORT_FOR_PROMOTION).toBe(10);
    expect(PROMOTE_COUNT).toBe(5);
    expect(DEMOTE_COUNT).toBe(5);
  });
});

describe("isCohortEligibleForPromotion", () => {
  test("false below the floor, true at and above it", () => {
    expect(isCohortEligibleForPromotion(9)).toBe(false);
    expect(isCohortEligibleForPromotion(10)).toBe(true);
    expect(isCohortEligibleForPromotion(30)).toBe(true);
  });
});
