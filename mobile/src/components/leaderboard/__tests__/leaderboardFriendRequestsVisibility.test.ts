import { shouldShowFriendRequestsCard } from "../leaderboardFriendRequestsVisibility";

describe("shouldShowFriendRequestsCard", () => {
  it("returns false when there are zero pending requests", () => {
    expect(shouldShowFriendRequestsCard(0)).toBe(false);
  });

  it("returns false when the count is undefined (not yet loaded)", () => {
    expect(shouldShowFriendRequestsCard(undefined)).toBe(false);
  });

  it("returns false when the count is null", () => {
    expect(shouldShowFriendRequestsCard(null)).toBe(false);
  });

  it("returns true when there is at least one pending request", () => {
    expect(shouldShowFriendRequestsCard(1)).toBe(true);
  });

  it("returns true for larger counts", () => {
    expect(shouldShowFriendRequestsCard(7)).toBe(true);
  });
});
