import type { HeartsPracticeProgress } from "@garzoni/core";

/**
 * Pure display-state derivation for the "practice to earn a heart back" CTA
 * in the out-of-hearts blocked state (see CourseFlowPage's `isBlocked` path).
 * Mirrors mobile/src/lesson/heartsPracticeStatus.ts — kept separate so the
 * "still practising" vs "hit today's cap" branch is unit-testable and the
 * component doesn't need to re-derive it inline.
 *
 * Server truth only: never grants anything, only decides what to show for
 * the progress snapshot returned by
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
  progress: HeartsPracticeProgress | null | undefined
): HeartsPracticeDisplayState {
  if (!progress) {
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
