import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLessonsWithProgress,
  completeSection,
  completeLesson,
  fetchCourseFlowState,
  saveCourseFlowState,
  mergeMissionDeltas,
  queryKeys,
  trackAnalyticsEvent,
  staleTimes,
  type MissionBuckets,
  type MissionDelta,
} from "@garzoni/core";
import { unwrapApiList } from "../lib/unwrapApiList";
import { trackEvent } from "../lib/analytics";

export type FlowSection = {
  id: number | string;
  title?: string;
  content_type?: string;
  text_content?: string;
  video_url?: string;
  exercise_type?: string;
  exercise_data?: Record<string, unknown>;
  order?: number;
  is_completed?: boolean;
  is_published?: boolean;
};

export type FlowLesson = {
  id: number;
  title?: string;
  short_description?: string;
  detailed_content?: string;
  is_completed?: boolean;
  sections: FlowSection[];
};

export type FlowItem =
  | {
      key: string;
      kind: "section";
      lessonId: number;
      lessonIndex: number;
      lessonTitle?: string;
      sectionIndex: number;
      section: FlowSection;
      isCompleted: boolean;
    }
  | {
      key: string;
      kind: "lesson-text";
      lessonId: number;
      lessonIndex: number;
      lessonTitle?: string;
      isCompleted: boolean;
      detailedContent?: string;
    };

export function useLessonFlow(
  courseId: number,
  options?: { initialLessonId?: number | null },
) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [courseComplete, setCourseComplete] = useState(false);
  // Mission the just-completed lesson finished (from the mutation response);
  // drives the in-flow celebration sheet.
  const [missionCompletedNow, setMissionCompletedNow] = useState<{
    name: string;
    xp: number;
  } | null>(null);
  // Set once, on the completion that stamped first_lesson_at server-side;
  // drives the one-time "first lesson ever" celebration variant.
  const [firstLessonCelebration, setFirstLessonCelebration] = useState<{
    bonusXp: number;
  } | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(0);

  const flowEnabled = Number.isFinite(courseId) && courseId > 0;

  // Mark progress queries stale WITHOUT refetching. Tab screens stay mounted
  // in expo-router, so an active invalidation here would refetch ~7 endpoints
  // on EVERY Continue tap (45 sections → hundreds of requests per course).
  // The flow screen flushes one active invalidation burst on exit/finish.
  const markProgressStale = useCallback(() => {
    const opts = { refetchType: "none" as const };
    void queryClient.invalidateQueries({
      queryKey: queryKeys.lessonsWithProgress(courseId),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.progressSummary(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.profile(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.activityHeatmap(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recentActivity(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.personalizedPath(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.learningPaths(),
      ...opts,
    });
    void queryClient.invalidateQueries({
      queryKey: ["learningPathCourses"],
      ...opts,
    });
  }, [queryClient, courseId]);

  const lessonsQuery = useQuery<FlowLesson[]>({
    queryKey: queryKeys.lessonsWithProgress(courseId),
    enabled: flowEnabled,
    queryFn: () =>
      fetchLessonsWithProgress(courseId).then((r) =>
        unwrapApiList<FlowLesson>(r.data),
      ),
    staleTime: staleTimes.content,
  });

  const flowStateQuery = useQuery<number>({
    queryKey: ["flowState", courseId],
    enabled: flowEnabled,
    queryFn: () =>
      fetchCourseFlowState(courseId).then(
        (r) => (r.data as { current_index?: number })?.current_index ?? 0,
      ),
    staleTime: 0,
  });

  const initialLessonId = options?.initialLessonId ?? null;
  const appliedInitialLessonRef = useRef(false);

  // Belt-and-braces alongside the `key={courseId}` remount in /flow/[id]:
  // if this hook instance ever survives a course change, drop stale state so
  // currentIndex/courseComplete from the previous course can't leak through.
  const prevCourseIdRef = useRef(courseId);
  useEffect(() => {
    if (prevCourseIdRef.current === courseId) return;
    prevCourseIdRef.current = courseId;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setCompletedIds(new Set());
    setCourseComplete(false);
    appliedInitialLessonRef.current = false;
  }, [courseId]);

  // Restore saved flow position on first load (unless a lesson deep-link target
  // is provided). Restore only ONCE: a slow in-flight refetch resolving after
  // the user has advanced must not yank them back to the older saved index.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (initialLessonId != null) return;
    if (restoredRef.current) return;
    if (flowStateQuery.data != null && flowStateQuery.data > 0) {
      restoredRef.current = true;
      setCurrentIndex(flowStateQuery.data);
    }
  }, [flowStateQuery.data, initialLessonId]);

  const flowItems = useMemo<FlowItem[]>(() => {
    const lessons = lessonsQuery.data ?? [];
    const items: FlowItem[] = [];
    lessons.forEach((lesson, li) => {
      if (lesson.sections && lesson.sections.length > 0) {
        lesson.sections
          .filter((s) => s.is_published !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .forEach((section, si) => {
            items.push({
              key: `s-${lesson.id}-${section.id}`,
              kind: "section",
              lessonId: lesson.id,
              lessonIndex: li,
              lessonTitle: lesson.title,
              sectionIndex: si,
              section,
              isCompleted:
                Boolean(section.is_completed) ||
                completedIds.has(`s-${section.id}`),
            });
          });
      } else if (lesson.detailed_content) {
        items.push({
          key: `l-${lesson.id}`,
          kind: "lesson-text",
          lessonId: lesson.id,
          lessonIndex: li,
          lessonTitle: lesson.title,
          isCompleted:
            Boolean(lesson.is_completed) || completedIds.has(`l-${lesson.id}`),
          detailedContent: lesson.detailed_content,
        });
      }
    });
    return items;
  }, [lessonsQuery.data, completedIds]);

  // Deep-link: jump to the first flow item for the requested lesson.
  useEffect(() => {
    if (appliedInitialLessonRef.current) return;
    if (initialLessonId == null || !Number.isFinite(initialLessonId)) return;
    if (!flowItems.length) return;
    const idx = flowItems.findIndex(
      (item) => item.lessonId === initialLessonId,
    );
    if (idx >= 0) {
      setCurrentIndex(idx);
      appliedInitialLessonRef.current = true;
    }
  }, [flowItems, initialLessonId]);

  const currentItem = flowItems[currentIndex] ?? null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= flowItems.length - 1;
  const totalSteps = flowItems.length;
  const completedSteps = flowItems.filter((i) => i.isCompleted).length;

  // Emit lesson_started once per lesson entered so the analytics dashboard can
  // measure post-signup activation and lesson engagement on mobile too.
  const startedLessonIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const lessonId = currentItem?.lessonId;
    if (!lessonId || !Number.isFinite(lessonId)) return;
    if (startedLessonIdsRef.current.has(lessonId)) return;
    startedLessonIdsRef.current.add(lessonId);
    trackEvent("lesson_started", { lesson_id: lessonId, course_id: courseId });
  }, [currentItem?.lessonId, courseId]);

  // Keep ref in sync so unmount handler sees latest index without stale closure.
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const persistFlowState = useCallback(
    (index: number) => {
      if (!flowEnabled) return;
      void saveCourseFlowState(courseId, index)
        .then(() => {
          queryClient.setQueryData(["flowState", courseId], index);
        })
        .catch(() => {});
    },
    [courseId, flowEnabled, queryClient],
  );

  // Autosave position (debounced while actively navigating).
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persistFlowState(currentIndex);
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [currentIndex, persistFlowState]);

  // Save immediately on unmount so navigating away never drops the last index.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      persistFlowState(currentIndexRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, flowEnabled]);

  const completeSectionMutation = useMutation({
    mutationFn: completeSection,
    // The flow UI tracks completion locally via completedIds; remote queries
    // are only marked stale and refetch in one burst when the flow exits.
    onSuccess: (_data, sectionId) => {
      trackEvent("section_completed", {
        section_id: Number(sectionId),
        course_id: courseId,
      });
      markProgressStale();
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: completeLesson,
    onSuccess: (data, lessonId) => {
      // lesson_completed funnel event is emitted server-side in
      // _complete_lesson_for_user; fire Amplitude + Customer.io client-side only
      // (recordFunnelEvent here would double-count in the funnel).
      trackAnalyticsEvent("lesson_completed", {
        lesson_id: lessonId,
        course_id: courseId,
      });
      void import("../bootstrap/customerIoMobile").then(
        ({ trackGarzoniEvent }) =>
          trackGarzoniEvent("lesson_completed", { lesson_id: lessonId }),
      );
      void import("../bootstrap/reviewPrompt").then(({ maybeRequestReview }) =>
        maybeRequestReview("lesson_complete"),
      );
      // The response carries authoritative mission states for this action —
      // merge into the missions cache so the Missions screen is already fresh,
      // and surface the first mission this lesson finished for a celebration
      // sheet (server-detected transition; can't re-fire on later lessons).
      const deltas: MissionDelta[] = data?.data?.missions ?? [];
      if (deltas.length > 0) {
        queryClient.setQueryData<MissionBuckets | undefined>(
          queryKeys.missions(),
          (prev) => mergeMissionDeltas(prev, deltas),
        );
      }
      const completedNow = data?.data?.missions_completed_now ?? [];
      if (completedNow.length > 0) {
        setMissionCompletedNow({
          name: completedNow[0].name ?? "",
          xp: completedNow.reduce((sum, m) => sum + (m.points_reward ?? 0), 0),
        });
      }
      // First-ever lesson (UX Phase 2, plan §2.6): server detects it once and
      // grants the bonus; hold it for the course-complete celebration screen.
      if (data?.data?.is_first_lesson) {
        setFirstLessonCelebration({
          bonusXp: data.data.first_lesson_bonus_xp ?? 0,
        });
        trackEvent("first_lesson_celebration_view", { course_id: courseId });
      }
      markProgressStale();
    },
  });

  const handleCompleteCurrent = useCallback(async (): Promise<boolean> => {
    if (!currentItem) return false;
    try {
      if (currentItem.kind === "section") {
        const sectionId = currentItem.section.id;
        await completeSectionMutation.mutateAsync(sectionId);
        setCompletedIds((prev) => new Set(prev).add(`s-${sectionId}`));
      } else {
        await completeLessonMutation.mutateAsync(currentItem.lessonId);
        setCompletedIds((prev) =>
          new Set(prev).add(`l-${currentItem.lessonId}`),
        );
      }
      return true;
    } catch {
      return false;
    }
  }, [currentItem, completeSectionMutation, completeLessonMutation]);

  const goNext = useCallback(() => {
    if (isLast) {
      setCourseComplete(true);
      return;
    }
    setCurrentIndex((i) => Math.min(i + 1, flowItems.length - 1));
  }, [isLast, flowItems.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  return {
    lessonsQuery,
    flowItems,
    currentIndex,
    currentItem,
    isFirst,
    isLast,
    totalSteps,
    completedSteps,
    completedIds,
    courseComplete,
    setCourseComplete,
    missionCompletedNow,
    setMissionCompletedNow,
    firstLessonCelebration,
    goNext,
    goPrev,
    handleCompleteCurrent,
    completeSectionMutation,
    completeLessonMutation,
  };
}
