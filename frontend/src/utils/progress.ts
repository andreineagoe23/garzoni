type NumericLike = number | string | null | undefined;

type ProgressIndex = {
  courseById: Map<string | number, number>;
  courseByTitle: Map<string, number>;
  pathAggById: Map<string | number, { sum: number; count: number }>;
  pathAggByTitle: Map<string, { sum: number; count: number }>;
  courseIdSet: Set<string | number>;
  courseTitleSet: Set<string>;
  pathIdSet: Set<string | number>;
  pathTitleSet: Set<string>;
};

type ProgressItem = {
  percent_complete?: NumericLike;
  course_id?: string | number | null;
  course?: string;
  path_id?: string | number | null;
  path?: string;
};

type ProgressSummary = {
  paths?: ProgressItem[];
};

type CourseLike = {
  id?: string | number | null;
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

type PathLike = {
  id?: string | number | null;
  title?: string;
  courses?: CourseLike[];
};

export function clampPercent(value: NumericLike) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

export function calculatePercent(
  completed: NumericLike,
  total: NumericLike,
  { round = false }: { round?: boolean } = {}
) {
  const completedNumber = Number(completed);
  const totalNumber = Number(total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0) return 0;
  if (!Number.isFinite(completedNumber) || completedNumber <= 0) return 0;
  const percent = (completedNumber / totalNumber) * 100;
  return clampPercent(round ? Math.round(percent) : percent);
}

export function indexProgressSummary(summary?: ProgressSummary | null): ProgressIndex {
  const items = summary?.paths || [];
  const courseById = new Map<string | number, number>();
  const courseByTitle = new Map<string, number>();
  const pathAggById = new Map<string | number, { sum: number; count: number }>();
  const pathAggByTitle = new Map<string, { sum: number; count: number }>();
  const courseIdSet = new Set<string | number>();
  const courseTitleSet = new Set<string>();
  const pathIdSet = new Set<string | number>();
  const pathTitleSet = new Set<string>();

  items.forEach((item: ProgressItem) => {
    const percent = clampPercent(item?.percent_complete ?? 0);
    if (item?.course_id !== null && item?.course_id !== undefined) {
      courseIdSet.add(item.course_id);
      courseById.set(item.course_id, percent);
    }
    if (item?.course) {
      courseTitleSet.add(item.course);
      courseByTitle.set(item.course, percent);
    }

    if (item?.path_id !== null && item?.path_id !== undefined) {
      pathIdSet.add(item.path_id);
      const current = pathAggById.get(item.path_id) || { sum: 0, count: 0 };
      current.sum += percent;
      current.count += 1;
      pathAggById.set(item.path_id, current);
    }
    if (item?.path) {
      pathTitleSet.add(item.path);
      const current = pathAggByTitle.get(item.path) || { sum: 0, count: 0 };
      current.sum += percent;
      current.count += 1;
      pathAggByTitle.set(item.path, current);
    }
  });

  return {
    courseById,
    courseByTitle,
    pathAggById,
    pathAggByTitle,
    courseIdSet,
    courseTitleSet,
    pathIdSet,
    pathTitleSet,
  };
}

export function hasCourseInIndex(index: ProgressIndex | null | undefined, course?: CourseLike | null) {
  const courseId = course?.id ?? null;
  if (courseId !== null && courseId !== undefined && index?.courseIdSet) {
    return index.courseIdSet.has(courseId);
  }
  if (course?.title && index?.courseTitleSet) {
    return index.courseTitleSet.has(course.title);
  }
  return false;
}

export function hasPathInIndex(index: ProgressIndex | null | undefined, path?: PathLike | null) {
  const pathId = path?.id ?? null;
  if (pathId !== null && pathId !== undefined && index?.pathIdSet) {
    return index.pathIdSet.has(pathId);
  }
  if (path?.title && index?.pathTitleSet) {
    return index.pathTitleSet.has(path.title);
  }
  return false;
}

export function getCourseProgressById(
  index: ProgressIndex | null | undefined,
  courseId?: string | number | null
) {
  if (!index?.courseById) return 0;
  if (courseId === null || courseId === undefined) return 0;
  return clampPercent(index.courseById.get(courseId) ?? 0);
}

export function getCourseProgressByTitle(
  index: ProgressIndex | null | undefined,
  title?: string | null
) {
  if (!index?.courseByTitle || !title) return 0;
  return clampPercent(index.courseByTitle.get(title) ?? 0);
}

export function getCourseProgressFromIndex(
  index: ProgressIndex | null | undefined,
  course?: CourseLike | null
) {
  const courseId = course?.id ?? null;
  const byId = getCourseProgressById(index, courseId);
  if (byId > 0 || (courseId !== null && courseId !== undefined)) {
    return byId;
  }
  return getCourseProgressByTitle(index, course?.title);
}

export function getCourseProgressFromCourse(course?: CourseLike | null) {
  if (!course) return 0;

  const completedSections =
    course.completed_sections ?? course.completedSections ?? null;
  const totalSections = course.total_sections ?? course.totalSections ?? null;
  const sectionPercent = calculatePercent(completedSections, totalSections);
  if (sectionPercent > 0 || Number(totalSections) > 0) {
    return sectionPercent;
  }

  const completedLessons =
    course.completed_lessons ?? course.completedLessons ?? null;
  const totalLessons =
    course.total_lessons ??
    course.totalLessons ??
    course.lesson_count ??
    course.lessonCount ??
    (Array.isArray(course.lessons) ? course.lessons.length : null);
  return calculatePercent(completedLessons, totalLessons);
}

export function getPathProgressFromCourses(
  courses: CourseLike[] | null | undefined,
  getCourseProgress?: (course: CourseLike) => number
) {
  if (!Array.isArray(courses) || courses.length === 0) return 0;
  const totals = courses.map((course) =>
    clampPercent(getCourseProgress?.(course) ?? 0)
  );
  const average =
    totals.length > 0
      ? totals.reduce((sum, v) => sum + v, 0) / totals.length
      : 0;
  return clampPercent(average);
}

export function getPathProgressById(
  index: ProgressIndex | null | undefined,
  pathId?: string | number | null
) {
  if (!index?.pathAggById) return 0;
  if (pathId === null || pathId === undefined) return 0;
  const agg = index.pathAggById.get(pathId);
  if (!agg || !agg.count) return 0;
  return clampPercent(agg.sum / agg.count);
}

export function getPathProgressByTitle(
  index: ProgressIndex | null | undefined,
  title?: string | null
) {
  if (!index?.pathAggByTitle || !title) return 0;
  const agg = index.pathAggByTitle.get(title);
  if (!agg || !agg.count) return 0;
  return clampPercent(agg.sum / agg.count);
}

export function getPathProgressFromIndex(
  index: ProgressIndex | null | undefined,
  path?: PathLike | null
) {
  const byId = getPathProgressById(index, path?.id);
  if (byId > 0 || (path?.id !== null && path?.id !== undefined)) {
    return byId;
  }

  const byTitle = getPathProgressByTitle(index, path?.title);
  if (byTitle > 0 || path?.title) {
    return byTitle;
  }

  const courses = Array.isArray(path?.courses) ? path.courses : [];
  if (!courses.length) return 0;
  const totals = courses.map((course) =>
    getCourseProgressFromIndex(index, course)
  );
  const average =
    totals.length > 0
      ? totals.reduce((sum, v) => sum + v, 0) / totals.length
      : 0;
  return clampPercent(average);
}

export function getCourseProgressFromSummary(
  summary: ProgressSummary | null | undefined,
  course?: CourseLike | null
) {
  const index = indexProgressSummary(summary);
  return getCourseProgressFromIndex(index, course);
}

export function getPathProgressFromSummary(
  summary: ProgressSummary | null | undefined,
  path?: PathLike | null
) {
  const index = indexProgressSummary(summary);
  return getPathProgressFromIndex(index, path);
}
