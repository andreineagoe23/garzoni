export function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

export function calculatePercent(completed, total, { round = false } = {}) {
  const completedNumber = Number(completed);
  const totalNumber = Number(total);
  if (!Number.isFinite(totalNumber) || totalNumber <= 0) return 0;
  if (!Number.isFinite(completedNumber) || completedNumber <= 0) return 0;
  const percent = (completedNumber / totalNumber) * 100;
  return clampPercent(round ? Math.round(percent) : percent);
}

export function indexProgressSummary(summary) {
  const items = summary?.paths || [];
  const courseById = new Map();
  const courseByTitle = new Map();
  const pathAggById = new Map();
  const pathAggByTitle = new Map();
  const courseIdSet = new Set();
  const courseTitleSet = new Set();
  const pathIdSet = new Set();
  const pathTitleSet = new Set();

  items.forEach((item) => {
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

export function hasCourseInIndex(index, course) {
  const courseId = course?.id ?? null;
  if (courseId !== null && courseId !== undefined && index?.courseIdSet) {
    return index.courseIdSet.has(courseId);
  }
  if (course?.title && index?.courseTitleSet) {
    return index.courseTitleSet.has(course.title);
  }
  return false;
}

export function hasPathInIndex(index, path) {
  const pathId = path?.id ?? null;
  if (pathId !== null && pathId !== undefined && index?.pathIdSet) {
    return index.pathIdSet.has(pathId);
  }
  if (path?.title && index?.pathTitleSet) {
    return index.pathTitleSet.has(path.title);
  }
  return false;
}

export function getCourseProgressById(index, courseId) {
  if (!index?.courseById) return 0;
  if (courseId === null || courseId === undefined) return 0;
  return clampPercent(index.courseById.get(courseId) ?? 0);
}

export function getCourseProgressByTitle(index, title) {
  if (!index?.courseByTitle || !title) return 0;
  return clampPercent(index.courseByTitle.get(title) ?? 0);
}

export function getCourseProgressFromIndex(index, course) {
  const courseId = course?.id ?? null;
  const byId = getCourseProgressById(index, courseId);
  if (byId > 0 || (courseId !== null && courseId !== undefined)) {
    return byId;
  }
  return getCourseProgressByTitle(index, course?.title);
}

export function getCourseProgressFromCourse(course) {
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

export function getPathProgressFromCourses(courses, getCourseProgress) {
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

export function getPathProgressById(index, pathId) {
  if (!index?.pathAggById) return 0;
  if (pathId === null || pathId === undefined) return 0;
  const agg = index.pathAggById.get(pathId);
  if (!agg || !agg.count) return 0;
  return clampPercent(agg.sum / agg.count);
}

export function getPathProgressByTitle(index, title) {
  if (!index?.pathAggByTitle || !title) return 0;
  const agg = index.pathAggByTitle.get(title);
  if (!agg || !agg.count) return 0;
  return clampPercent(agg.sum / agg.count);
}

export function getPathProgressFromIndex(index, path) {
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

export function getCourseProgressFromSummary(summary, course) {
  const index = indexProgressSummary(summary);
  return getCourseProgressFromIndex(index, course);
}

export function getPathProgressFromSummary(summary, path) {
  const index = indexProgressSummary(summary);
  return getPathProgressFromIndex(index, path);
}
