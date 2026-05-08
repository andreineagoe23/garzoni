import type {
  PersonalizedPathCourse,
  PersonalizedPathResponse,
  ProgressSummary,
} from "types/api";

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
    const totalSections = Number(entry.total_sections || 0);
    const completedSections = Number(entry.completed_sections || 0);
    const sectionPercent =
      totalSections > 0
        ? Math.round((completedSections / totalSections) * 100)
        : Number(entry.percent_complete || 0);

    map.set(entry.course_id, {
      percent: sectionPercent,
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
  const fallbackCompletedLessons = Number(course.completed_lessons || 0);
  const fallbackTotalLessons = Number(course.total_lessons || 0);
  const completedLessons =
    progress?.completedLessons ?? fallbackCompletedLessons;
  const totalLessons = progress?.totalLessons ?? fallbackTotalLessons;
  const completedSections =
    progress?.completedSections ?? Number(course.completed_sections || 0);
  const totalSections =
    progress?.totalSections ?? Number(course.total_sections || 0);
  const percent =
    progress?.percent ??
    (totalLessons > 0
      ? Math.round((completedLessons / Math.max(totalLessons, 1)) * 100)
      : Number(course.completion_percent || 0));
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
  };
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
