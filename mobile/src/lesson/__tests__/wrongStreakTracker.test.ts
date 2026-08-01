import {
  INITIAL_WRONG_STREAK_STATE,
  nextWrongStreakState,
} from "../wrongStreakTracker";

describe("nextWrongStreakState", () => {
  it("does not trigger AI help after a single wrong attempt", () => {
    const result = nextWrongStreakState(INITIAL_WRONG_STREAK_STATE, 0, false);
    expect(result.shouldTriggerAiHelp).toBe(false);
    expect(result.state).toEqual({ index: 0, count: 1 });
  });

  it("triggers AI help on the 2nd consecutive wrong attempt", () => {
    const first = nextWrongStreakState(INITIAL_WRONG_STREAK_STATE, 0, false);
    const second = nextWrongStreakState(first.state, 0, false);

    expect(second.shouldTriggerAiHelp).toBe(true);
    expect(second.state).toEqual({ index: 0, count: 2 });
  });

  it("does not re-trigger on a 3rd consecutive wrong attempt", () => {
    const first = nextWrongStreakState(INITIAL_WRONG_STREAK_STATE, 0, false);
    const second = nextWrongStreakState(first.state, 0, false);
    const third = nextWrongStreakState(second.state, 0, false);

    expect(third.shouldTriggerAiHelp).toBe(false);
    expect(third.state).toEqual({ index: 0, count: 3 });
  });

  it("resets the streak on a correct answer", () => {
    const first = nextWrongStreakState(INITIAL_WRONG_STREAK_STATE, 0, false);
    const correct = nextWrongStreakState(first.state, 0, true);

    expect(correct.shouldTriggerAiHelp).toBe(false);
    expect(correct.state).toEqual({ index: 0, count: 0 });

    // A wrong answer right after resets to a fresh streak of 1, not 2.
    const nextWrong = nextWrongStreakState(correct.state, 0, false);
    expect(nextWrong.shouldTriggerAiHelp).toBe(false);
    expect(nextWrong.state).toEqual({ index: 0, count: 1 });
  });

  it("resets the streak when the exercise (index) changes", () => {
    const first = nextWrongStreakState(INITIAL_WRONG_STREAK_STATE, 0, false);
    // Learner moves to a new exercise before hitting the 2nd wrong on the old one.
    const onNewExercise = nextWrongStreakState(first.state, 1, false);

    expect(onNewExercise.shouldTriggerAiHelp).toBe(false);
    expect(onNewExercise.state).toEqual({ index: 1, count: 1 });

    const secondWrongOnNewExercise = nextWrongStreakState(
      onNewExercise.state,
      1,
      false,
    );
    expect(secondWrongOnNewExercise.shouldTriggerAiHelp).toBe(true);
    expect(secondWrongOnNewExercise.state).toEqual({ index: 1, count: 2 });
  });
});
