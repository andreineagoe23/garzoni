/**
 * Single source of truth for course-progress derivation on the client.
 *
 * Mirrors the backend (`education.progress`): progress is **section-based and
 * published-only**. The journey ring, course cards, dashboard, and lesson
 * counter all derive their percent from here so they can never disagree.
 *
 * The backend now publishes section-based `completed_sections` / `total_sections`
 * on both `progress_summary` and `personalized-path`, so section totals are the
 * primary signal; lessons / server percent are fallbacks for courses that have
 * no published sections.
 */

export type CourseProgressInput = {
  completed_sections?: number | null;
  total_sections?: number | null;
  /** Fallbacks when a course has no published section totals. */
  completed_lessons?: number | null;
  total_lessons?: number | null;
  /** progress_summary path entry. */
  percent_complete?: number | null;
  /** personalized-path course. */
  completion_percent?: number | null;
};

export type CourseProgress = {
  completedSections: number;
  totalSections: number;
  /** 0–100, section-based when section totals are present. */
  percent: number;
  isComplete: boolean;
};

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function num(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function computeCourseProgress(
  input?: CourseProgressInput | null,
): CourseProgress {
  const completedSections = num(input?.completed_sections);
  const totalSections = num(input?.total_sections);

  if (totalSections > 0) {
    const completed = Math.min(completedSections, totalSections);
    return {
      completedSections: completed,
      totalSections,
      percent: clampPercent(Math.round((completed / totalSections) * 100)),
      isComplete: completed >= totalSections,
    };
  }

  // No published section totals — fall back to lessons, then the server percent.
  const completedLessons = num(input?.completed_lessons);
  const totalLessons = num(input?.total_lessons);
  if (totalLessons > 0) {
    const completed = Math.min(completedLessons, totalLessons);
    return {
      completedSections,
      totalSections,
      percent: clampPercent(Math.round((completed / totalLessons) * 100)),
      isComplete: completed >= totalLessons,
    };
  }

  const serverPercent = clampPercent(
    Math.round(Number(input?.percent_complete ?? input?.completion_percent ?? 0)),
  );
  return {
    completedSections,
    totalSections,
    percent: serverPercent,
    isComplete: serverPercent >= 100,
  };
}
