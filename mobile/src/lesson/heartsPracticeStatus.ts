import type { HeartsPracticeProgress } from "@garzoni/core";

/**
 * Pure display-state derivation for the "practice to earn a heart back" CTA
 * in the out-of-hearts modal (see LessonFlowScreen). Kept separate from the
 * modal JSX so the branch between "still practising" and "hit today's cap"
 * is unit-testable without rendering native components.
 *
 * Server truth only: this never grants anything, it only decides what text
 * to show for the progress snapshot returned by
 * authentication.services.hearts.hearts_practice_progress.
 */
export type HeartsPracticeDisplayState =
  | { kind: "capReached"; grantedToday: number; dailyCap: number }
  | {
      kind: "inProgress";
      correctSoFar: number;
      correctNeeded: number;
      remaining: number;
    };

export function heartsPracticeDisplayState(
  progress: HeartsPracticeProgress | null | undefined,
): HeartsPracticeDisplayState {
  if (!progress) {
    // No data yet (still loading, or request failed) — render the "not
    // capped" shape with a safe default of 0 correct so far. The screen
    // shouldn't claim the cap is reached without server confirmation.
    return {
      kind: "inProgress",
      correctSoFar: 0,
      correctNeeded: 2,
      remaining: 2,
    };
  }

  const dailyCap = Math.max(0, Math.floor(progress.daily_cap ?? 0));
  const grantedToday = Math.max(0, Math.floor(progress.granted_today ?? 0));
  if (grantedToday >= dailyCap) {
    return { kind: "capReached", grantedToday, dailyCap };
  }

  const correctNeeded = Math.max(1, Math.floor(progress.correct_needed ?? 1));
  const correctSoFar = Math.max(0, Math.floor(progress.correct_so_far ?? 0));
  return {
    kind: "inProgress",
    correctSoFar,
    correctNeeded,
    remaining: Math.max(0, correctNeeded - correctSoFar),
  };
}
