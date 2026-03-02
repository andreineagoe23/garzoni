import { useCallback, useMemo } from "react";
import { useProgressStore } from "stores/progressStore";
import { useProgressSummaryQuery } from "hooks/useProgressSummaryQuery";
import {
  clampPercent,
  getCourseProgressFromCourse,
  getPathProgressFromCourses,
  hasCourseInIndex,
  hasPathInIndex,
  indexProgressSummary,
  getCourseProgressById,
  getCourseProgressByTitle,
  getCourseProgressFromIndex,
  getPathProgressById,
  getPathProgressByTitle,
  getPathProgressFromIndex,
} from "utils/progress";

export function useProgressMetrics(options = {}) {
  const query = useProgressSummaryQuery(options);
  const summary = useMemo(
    () => query.data?.data || { paths: [] },
    [query.data]
  );

  const index = useMemo(() => indexProgressSummary(summary), [summary]);
  const courseFlow = useProgressStore((state) => state.courseFlow);
  const liveCourseId = courseFlow?.courseId ?? null;
  const liveCoursePercent = clampPercent(courseFlow?.percent ?? 0);
  const hasLiveCourseProgress =
    Number.isFinite(courseFlow?.totalSteps) && courseFlow.totalSteps > 0;

  const getCourseProgress = useCallback(
    (course) => {
      const courseId = course?.id ?? null;
      if (
        hasLiveCourseProgress &&
        courseId !== null &&
        courseId === liveCourseId
      ) {
        return liveCoursePercent;
      }

      if (hasCourseInIndex(index, course)) {
        return getCourseProgressFromIndex(index, course);
      }

      return getCourseProgressFromCourse(course);
    },
    [hasLiveCourseProgress, index, liveCourseId, liveCoursePercent]
  );
  const getCourseProgressId = useCallback(
    (courseId) => getCourseProgressById(index, courseId),
    [index]
  );
  const getCourseProgressTitle = useCallback(
    (title) => getCourseProgressByTitle(index, title),
    [index]
  );
  const getPathProgress = useCallback(
    (path) => {
      if (hasPathInIndex(index, path)) {
        return getPathProgressFromIndex(index, path);
      }
      return getPathProgressFromCourses(path?.courses || [], getCourseProgress);
    },
    [getCourseProgress, index]
  );
  const getPathProgressId = useCallback(
    (pathId) => getPathProgressById(index, pathId),
    [index]
  );
  const getPathProgressTitle = useCallback(
    (title) => getPathProgressByTitle(index, title),
    [index]
  );

  return {
    ...query,
    summary,
    index,
    getCourseProgress,
    getCourseProgressId,
    getCourseProgressTitle,
    getPathProgress,
    getPathProgressId,
    getPathProgressTitle,
  };
}
