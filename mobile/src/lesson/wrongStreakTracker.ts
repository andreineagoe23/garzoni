/**
 * Pure tracking logic for "real AI intervention on repeat wrong answers":
 * counts CONSECUTIVE wrong attempts on the current exercise and decides when
 * the flow screen should show the AI rescue sheet.
 *
 * Kept as a pure function (rather than inline refs) so the trigger rule is
 * unit-testable without rendering the full lesson flow screen.
 */
export type WrongStreakState = {
  /** Identity of the exercise the streak belongs to (e.g. the flow's currentIndex). */
  index: number | null;
  /** Consecutive wrong attempts recorded for that exercise. */
  count: number;
};

export const INITIAL_WRONG_STREAK_STATE: WrongStreakState = {
  index: null,
  count: 0,
};

export type WrongStreakResult = {
  state: WrongStreakState;
  /** True exactly once per exercise: on the 2nd consecutive wrong attempt. */
  shouldTriggerAiHelp: boolean;
};

/**
 * Advance the streak for an attempt on `currentIndex`.
 * - A correct answer resets the streak to 0 (no AI help trigger).
 * - Switching exercises (index changes) resets the streak before counting
 *   the new attempt.
 * - `shouldTriggerAiHelp` is true only when the running count reaches
 *   exactly 2 — later consecutive wrongs on the same exercise fall through
 *   to the normal (immediate) heart decrement.
 */
export function nextWrongStreakState(
  state: WrongStreakState,
  currentIndex: number,
  correct: boolean,
): WrongStreakResult {
  if (correct) {
    return {
      state: { index: currentIndex, count: 0 },
      shouldTriggerAiHelp: false,
    };
  }

  const sameExercise = state.index === currentIndex;
  const count = (sameExercise ? state.count : 0) + 1;

  return {
    state: { index: currentIndex, count },
    shouldTriggerAiHelp: count === 2,
  };
}
