import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLessonsWithProgress,
  completeSection,
  completeLesson,
  fetchCourseFlowState,
  saveCourseFlowState,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { unwrapApiList } from "../lib/unwrapApiList";

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

export function useLessonFlow(courseId: number) {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [courseComplete, setCourseComplete] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flowEnabled = Number.isFinite(courseId) && courseId > 0;

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
    staleTime: staleTimes.content,
  });

  // Restore saved flow position on first load
  useEffect(() => {
    if (flowStateQuery.data != null && flowStateQuery.data > 0) {
      setCurrentIndex(flowStateQuery.data);
    }
  }, [flowStateQuery.data]);

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

  const currentItem = flowItems[currentIndex] ?? null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= flowItems.length - 1;
  const totalSteps = flowItems.length;
  const completedSteps = flowItems.filter((i) => i.isCompleted).length;

  // Autosave position
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (flowEnabled) {
        void saveCourseFlowState(courseId, currentIndex).catch(() => {});
      }
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [currentIndex, courseId, flowEnabled]);

  const completeSectionMutation = useMutation({
    mutationFn: completeSection,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.progressSummary(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activityHeatmap(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentActivity(),
      });
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: completeLesson,
    onSuccess: (_data, lessonId) => {
      void import("../bootstrap/customerIoMobile").then(({ trackGarzoniEvent }) =>
        trackGarzoniEvent("lesson_completed", { lesson_id: lessonId }),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.progressSummary(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activityHeatmap(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentActivity(),
      });
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
    goNext,
    goPrev,
    handleCompleteCurrent,
    completeSectionMutation,
    completeLessonMutation,
  };
}
