/**
 * Pure visibility predicate for LeaderboardFriendRequestsCard: with zero
 * pending incoming requests the card should not render at all (previously
 * it always rendered, including a full empty-state box).
 */
export function shouldShowFriendRequestsCard(
  incomingCount: number | undefined | null,
): boolean {
  return (incomingCount ?? 0) > 0;
}
