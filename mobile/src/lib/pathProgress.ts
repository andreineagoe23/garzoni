import { computeCourseProgress } from "@garzoni/core";

type NumericLike = number | string | null | undefined;

export type CourseProgressLike = {
  id?: number | string | null;
  title?: string;
  completed_sections?: NumericLike;
  completedSections?: NumericLike;
  total_sections?: NumericLike;
  totalSections?: NumericLike;
  completed_lessons?: NumericLike;
  completedLessons?: NumericLike;
  total_lessons?: NumericLike;
  totalLessons?: NumericLike;
  lesson_count?: NumericLike;
  lessonCount?: NumericLike;
  lessons?: unknown[];
};

export type PathProgressLike = {
  id?: number | string | null;
  title?: string;
  name?: string;
  courses?: CourseProgressLike[];
};

function clampPercent(value: NumericLike) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function toNum(value: NumericLike): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getCourseLessonCount(
  course: CourseProgressLike | undefined,
): number {
  if (!course) return 0;
  const fromTotal =
    course.total_lessons ??
    course.totalLessons ??
    course.lesson_count ??
    course.lessonCount ??
    null;
  const n = Number(fromTotal);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  if (Array.isArray(course.lessons)) return course.lessons.length;
  return 0;
}

function courseProgressPercent(course: CourseProgressLike | undefined): number {
  if (!course) return 0;
  // Single source of truth (@garzoni/core): section-based, lessons as fallback.
  const lessonTotal = getCourseLessonCount(course);
  return computeCourseProgress({
    completed_sections: toNum(
      course.completed_sections ?? course.completedSections,
    ),
    total_sections: toNum(course.total_sections ?? course.totalSections),
    completed_lessons: toNum(
      course.completed_lessons ?? course.completedLessons,
    ),
    total_lessons: lessonTotal > 0 ? lessonTotal : null,
  }).percent;
}

/** 0–100, rounded — average progress across courses in the path. */
export function pathProgressPercent(
  path: PathProgressLike | undefined,
): number {
  const courses = path?.courses;
  if (!Array.isArray(courses) || courses.length === 0) return 0;
  const parts = courses.map((c) => clampPercent(courseProgressPercent(c)));
  const avg = parts.reduce((s, v) => s + v, 0) / parts.length;
  return Math.round(clampPercent(avg));
}

export function applyPathSortAndFilter<T extends PathProgressLike>(
  paths: readonly T[],
  sortBy: string,
  pathFilter: string,
): T[] {
  let result = [...paths];

  if (pathFilter === "in-progress") {
    result = result.filter((p) => {
      const prog = pathProgressPercent(p);
      return prog > 0 && prog < 100;
    });
  } else if (pathFilter === "not-started") {
    result = result.filter((p) => pathProgressPercent(p) === 0);
  } else if (pathFilter === "completed") {
    result = result.filter((p) => pathProgressPercent(p) === 100);
  }

  const label = (p: T) => String(p.title ?? p.name ?? "");

  if (sortBy === "progress-asc") {
    result.sort((a, b) => pathProgressPercent(a) - pathProgressPercent(b));
  } else if (sortBy === "progress-desc" || sortBy === "easiest") {
    result.sort((a, b) => pathProgressPercent(b) - pathProgressPercent(a));
  } else if (sortBy === "hardest") {
    result.sort((a, b) => pathProgressPercent(a) - pathProgressPercent(b));
  } else if (sortBy === "name") {
    result.sort((a, b) => label(a).localeCompare(label(b)));
  }

  return result;
}
