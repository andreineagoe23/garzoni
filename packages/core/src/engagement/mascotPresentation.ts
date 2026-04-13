import type { MascotMood, MascotType } from "./mascotTypes";

export const MASCOT_SITUATIONS = [
  "lesson_reading",
  "lesson_exercise_neutral",
  "lesson_exercise_correct",
  "lesson_exercise_incorrect",
  "lesson_section_completed",
  "lesson_course_completed",
  "practice_neutral",
  "practice_correct",
  "practice_incorrect",
  "quiz_correct",
  "quiz_incorrect",
  "quiz_complete",
  "missions_wrapup_all_done",
  "missions_wrapup_progress",
  "onboarding_complete",
] as const;

export type MascotSituation = (typeof MASCOT_SITUATIONS)[number];

const OWL_CELEBRATE = [
  "mascotPools.owl.celebrate_0",
  "mascotPools.owl.celebrate_1",
  "mascotPools.owl.celebrate_2",
] as const;

const BULL_ENCOURAGE = [
  "mascotPools.bull.encourage_0",
  "mascotPools.bull.encourage_1",
  "mascotPools.bull.encourage_2",
] as const;

const BEAR_NEUTRAL = [
  "mascotPools.bear.neutral_0",
  "mascotPools.bear.neutral_1",
  "mascotPools.bear.neutral_2",
] as const;

const LESSON_READING = [
  "mascotPools.lesson.reading_0",
  "mascotPools.lesson.reading_1",
  "mascotPools.lesson.reading_2",
] as const;

const LESSON_EXERCISE_NEUTRAL = [
  "mascotPools.lesson.exerciseNeutral_0",
  "mascotPools.lesson.exerciseNeutral_1",
  "mascotPools.lesson.exerciseNeutral_2",
] as const;

const LESSON_SECTION_DONE = [
  "mascotPools.lesson.sectionCompleted_0",
  "mascotPools.lesson.sectionCompleted_1",
  "mascotPools.lesson.sectionCompleted_2",
] as const;

const LESSON_COURSE_DONE = [
  "mascotPools.lesson.courseCompleted_0",
  "mascotPools.lesson.courseCompleted_1",
  "mascotPools.lesson.courseCompleted_2",
] as const;

const PRACTICE_NEUTRAL = [
  "mascotPools.practice.neutral_0",
  "mascotPools.practice.neutral_1",
  "mascotPools.practice.neutral_2",
] as const;

const QUIZ_COMPLETE = [
  "mascotPools.quiz.complete_0",
  "mascotPools.quiz.complete_1",
  "mascotPools.quiz.complete_2",
] as const;

const MISSIONS_PROGRESS = [
  "mascotPools.missions.progress_0",
  "mascotPools.missions.progress_1",
  "mascotPools.missions.progress_2",
] as const;

export type ResolvedMascotPresentation = {
  mood: MascotMood;
  fixedMascot?: MascotType;
  messagePoolKeys: string[];
};

const SITUATION_MAP: Record<
  MascotSituation,
  { mood: MascotMood; fixedMascot?: MascotType; keys: readonly string[] }
> = {
  lesson_reading: {
    mood: "neutral",
    fixedMascot: "bear",
    keys: LESSON_READING,
  },
  lesson_exercise_neutral: {
    mood: "neutral",
    fixedMascot: "bear",
    keys: LESSON_EXERCISE_NEUTRAL,
  },
  lesson_exercise_correct: { mood: "celebrate", keys: OWL_CELEBRATE },
  lesson_exercise_incorrect: { mood: "encourage", keys: BULL_ENCOURAGE },
  lesson_section_completed: { mood: "celebrate", keys: LESSON_SECTION_DONE },
  lesson_course_completed: { mood: "celebrate", keys: LESSON_COURSE_DONE },
  practice_neutral: {
    mood: "neutral",
    fixedMascot: "bear",
    keys: PRACTICE_NEUTRAL,
  },
  practice_correct: { mood: "celebrate", keys: OWL_CELEBRATE },
  practice_incorrect: { mood: "encourage", keys: BULL_ENCOURAGE },
  quiz_correct: { mood: "celebrate", keys: OWL_CELEBRATE },
  quiz_incorrect: { mood: "encourage", keys: BULL_ENCOURAGE },
  quiz_complete: { mood: "celebrate", keys: QUIZ_COMPLETE },
  missions_wrapup_all_done: { mood: "celebrate", keys: OWL_CELEBRATE },
  missions_wrapup_progress: {
    mood: "neutral",
    fixedMascot: "bear",
    keys: MISSIONS_PROGRESS,
  },
  onboarding_complete: { mood: "celebrate", keys: OWL_CELEBRATE },
};

/**
 * Pure mapping from learner context to mascot mood, optional fixed character, and i18n pool keys.
 */
export function resolveMascotPresentation(
  situation: MascotSituation,
): ResolvedMascotPresentation {
  const row = SITUATION_MAP[situation];
  if (!row) {
    return {
      mood: "neutral",
      fixedMascot: "bear",
      messagePoolKeys: [...BEAR_NEUTRAL],
    };
  }
  return {
    mood: row.mood,
    fixedMascot: row.fixedMascot,
    messagePoolKeys: [...row.keys],
  };
}
