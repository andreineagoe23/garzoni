import type {
  PersonalizedPathCourse,
  PersonalizedPathResponse,
  ProgressSummary,
} from "types/api";
import { computeCourseProgress } from "./courseProgress";

export type PersonalizedPathCourseProgress = {
  percent: number;
  completedSections: number;
  totalSections: number;
  completedLessons: number;
  totalLessons: number;
};

export type PersonalizedPathMetrics = {
  percent: number;
  completedLessons: number;
  totalLessons: number;
  completedSections: number;
  totalSections: number;
  estimatedMinutes: number;
  /** Section-based completion (every published section done). */
  isComplete: boolean;
};

export type PersonalizedPathDerivedState = {
  courses: PersonalizedPathCourse[];
  heroCourse?: PersonalizedPathCourse;
  restCourses: PersonalizedPathCourse[];
  reviewQueue: NonNullable<PersonalizedPathResponse["review_queue"]>;
  isPreview: boolean;
  hasCourses: boolean;
};

export function buildProgressByCourse(
  progressSummary?: ProgressSummary | null,
) {
  const entries = progressSummary?.paths || [];
  const map = new Map<number, PersonalizedPathCourseProgress>();

  entries.forEach((entry) => {
    if (!entry.course_id) return;
    const { percent, completedSections, totalSections } =
      computeCourseProgress(entry);

    map.set(entry.course_id, {
      percent,
      completedSections,
      totalSections,
      completedLessons: Number(entry.completed_lessons || 0),
      totalLessons: Number(entry.total_lessons || 0),
    });
  });

  return map;
}

export function getCourseMetrics(
  course: PersonalizedPathCourse,
  progressByCourse: Map<number, PersonalizedPathCourseProgress>,
): PersonalizedPathMetrics {
  const progress = progressByCourse.get(course.id);
  const completedLessons =
    progress?.completedLessons ?? Number(course.completed_lessons || 0);
  const totalLessons = progress?.totalLessons ?? Number(course.total_lessons || 0);
  // Both progress_summary and personalized-path now publish section-based,
  // published-only counts. They can briefly lag each other (progress_summary is
  // cached ~60s), so merge by taking the higher completedSections against a
  // consistent total, then derive everything from the single shared util.
  const pathTotalSections = Number(course.total_sections || 0);
  const totalSections = pathTotalSections > 0
    ? pathTotalSections
    : (progress?.totalSections ?? 0);
  const completedSectionsMerged = Math.max(
    Number(course.completed_sections || 0),
    progress?.completedSections ?? 0,
  );
  const sectionProgress = computeCourseProgress({
    completed_sections: completedSectionsMerged,
    total_sections: totalSections,
    completed_lessons: completedLessons,
    total_lessons: totalLessons,
    completion_percent: course.completion_percent,
  });
  const completedSections = sectionProgress.completedSections;
  const percent = sectionProgress.percent;
  const estimatedMinutes =
    Number(course.estimated_minutes || 0) > 0
      ? Number(course.estimated_minutes || 0)
      : Math.max(totalLessons * 4, 8);

  return {
    percent,
    completedLessons,
    totalLessons,
    completedSections,
    totalSections,
    estimatedMinutes,
    isComplete: sectionProgress.isComplete,
  };
}

/** Next unlocked course in the personalized path after `currentCourseId`. */
export function getNextPersonalizedPathCourse(
  courses: PersonalizedPathCourse[],
  currentCourseId: number,
): PersonalizedPathCourse | null {
  const index = courses.findIndex((c) => c.id === currentCourseId);
  if (index === -1) return null;
  for (let i = index + 1; i < courses.length; i++) {
    const course = courses[i];
    if (!course.locked) return course;
  }
  return null;
}

export function derivePersonalizedPathState(
  response?: PersonalizedPathResponse | null,
): PersonalizedPathDerivedState {
  const courses = response?.courses || [];
  return {
    courses,
    heroCourse: courses[0],
    restCourses: courses.slice(1),
    reviewQueue: response?.review_queue || [],
    isPreview: Boolean(response?.meta?.preview),
    hasCourses: courses.length > 0,
  };
}

export function shouldAutoRefreshEmptyPath(opts: {
  questionnaireCompleted: boolean;
  personalizedFetchSucceeded: boolean;
  coursesLength: number;
  isRefreshing: boolean;
  alreadyTriggered: boolean;
}) {
  return (
    opts.questionnaireCompleted &&
    opts.personalizedFetchSucceeded &&
    opts.coursesLength === 0 &&
    !opts.isRefreshing &&
    !opts.alreadyTriggered
  );
}

export function buildSkillPracticeHref(
  skill: string,
  intentReason = "weak_skill_practice",
) {
  const q = new URLSearchParams();
  if (skill.trim()) q.set("skill", skill.trim());
  q.set("intentReason", intentReason);
  return `/exercises?${q.toString()}`;
}
