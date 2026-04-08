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

function calculatePercent(completed: NumericLike, total: NumericLike) {
  const c = Number(completed);
  const t = Number(total);
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (!Number.isFinite(c) || c <= 0) return 0;
  return clampPercent((c / t) * 100);
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

  const sectionPct = calculatePercent(
    course.completed_sections ?? course.completedSections ?? null,
    course.total_sections ?? course.totalSections ?? null,
  );
  if (
    sectionPct > 0 ||
    Number(course.total_sections ?? course.totalSections) > 0
  ) {
    return sectionPct;
  }

  const totalLessons =
    course.total_lessons ??
    course.totalLessons ??
    course.lesson_count ??
    course.lessonCount ??
    (Array.isArray(course.lessons) ? course.lessons.length : null);

  return calculatePercent(
    course.completed_lessons ?? course.completedLessons ?? null,
    totalLessons,
  );
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
