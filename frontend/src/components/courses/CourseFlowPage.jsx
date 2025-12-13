import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "contexts/AuthContext";
import {
  completeLesson,
  completeSection,
  decrementHearts,
  fetchCourseById,
  fetchLearningPathCourses,
  fetchLessonsWithProgress,
  fetchCourseFlowState,
  fetchHearts,
  grantHearts,
  refillHearts,
  saveCourseFlowState,
} from "services/userService";
import { attachToken } from "services/httpClient";
import { BACKEND_URL } from "services/backendUrl";
import MultipleChoiceExercise from "components/exercises/MultipleChoiceExercise";
import DragAndDropExercise from "components/exercises/DragAndDropExercise";
import BudgetAllocationExercise from "components/exercises/BudgetAllocationExercise";
import Skeleton from "components/common/Skeleton";
import { usePreferences } from "hooks/usePreferences";

const DEFAULT_MAX_HEARTS = 5;

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function HeartIcon({ filled }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={filled ? "text-rose-500" : "text-rose-500/25"}
      style={{ display: "block" }}
    >
      <path
        fill="currentColor"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.22 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  );
}

function fixImagePaths(content) {
  if (!content) return "";
  const mediaUrl = `${BACKEND_URL}/media/`;
  return content.replace(/src="\/media\/([^"]+)"/g, (_, filename) => {
    return `src="${mediaUrl}${filename}"`;
  });
}

function CourseFlowPage() {
  const { courseId, pathId } = useParams();
  const courseIdNumber = useMemo(
    () => Number.parseInt(courseId, 10),
    [courseId]
  );
  const pathIdNumber = useMemo(
    () => (pathId ? Number.parseInt(pathId, 10) : NaN),
    [pathId]
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { preferences } = usePreferences();
  const useImmersive = preferences?.immersiveCourseFlow !== false;

  const [flowSections, setFlowSections] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSectionIds, setCompletedSectionIds] = useState([]);
  const [courseComplete, setCourseComplete] = useState(false);

  const heartsEnabled = preferences?.heartsEnabled !== false;
  const [showOutOfHearts, setShowOutOfHearts] = useState(false);
  const [heartsFetchedAtMs, setHeartsFetchedAtMs] = useState(() => Date.now());
  const [heartTimerNowMs, setHeartTimerNowMs] = useState(() => Date.now());
  const [didApplyInitialIndex, setDidApplyInitialIndex] = useState(false);

  useEffect(() => {
    setDidApplyInitialIndex(false);
    setCourseComplete(false);
    setCurrentIndex(0);
    setShowOutOfHearts(false);
  }, [courseIdNumber]);

  useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  // Keep the immersive page fixed (prevent body scroll across all screens).
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const shouldRedirectToCanonical =
    Number.isFinite(courseIdNumber) && !Number.isFinite(pathIdNumber);

  const { data: courseMeta, isLoading: isCourseMetaLoading } = useQuery({
    queryKey: ["course", courseIdNumber],
    queryFn: () => fetchCourseById(courseIdNumber).then((r) => r.data),
    enabled: shouldRedirectToCanonical,
  });

  useEffect(() => {
    if (!shouldRedirectToCanonical) return;
    const canonicalPathId = courseMeta?.path;
    if (!canonicalPathId) return;
    navigate(`/courses/${canonicalPathId}/lessons/${courseIdNumber}/flow`, {
      replace: true,
    });
  }, [courseIdNumber, courseMeta?.path, navigate, shouldRedirectToCanonical]);

  const {
    data: lessonsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lessons", courseId, "flow"],
    queryFn: () => fetchLessonsWithProgress(courseId, false),
    select: (response) => response.data || [],
    enabled:
      !shouldRedirectToCanonical || (!isCourseMetaLoading && !courseMeta?.path),
  });

  const { data: heartsData, refetch: refetchHearts } = useQuery({
    queryKey: ["hearts"],
    queryFn: () => fetchHearts().then((response) => response.data),
    enabled: heartsEnabled,
    refetchInterval: heartsEnabled ? 30_000 : false,
  });

  useEffect(() => {
    if (heartsData) {
      setHeartsFetchedAtMs(Date.now());
    }
  }, [heartsData]);

  const { data: flowStateData, isFetched: isFlowStateFetched } = useQuery({
    queryKey: ["flow-state", courseIdNumber],
    queryFn: () => fetchCourseFlowState(courseIdNumber).then((r) => r.data),
    enabled:
      Number.isFinite(courseIdNumber) &&
      (!shouldRedirectToCanonical || !isCourseMetaLoading),
  });

  const { data: pathCourses, isLoading: isPathCoursesLoading } = useQuery({
    queryKey: ["learning-path-courses", pathIdNumber],
    queryFn: () =>
      fetchLearningPathCourses(pathIdNumber).then(
        (response) => response.data?.data || response.data || []
      ),
    enabled: Number.isFinite(pathIdNumber),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const maxHearts = heartsEnabled
    ? heartsData?.max_hearts ?? DEFAULT_MAX_HEARTS
    : DEFAULT_MAX_HEARTS;
  const hearts = heartsEnabled ? heartsData?.hearts ?? maxHearts : maxHearts;
  const nextHeartInSecondsRaw = heartsEnabled
    ? heartsData?.next_heart_in_seconds ?? null
    : null;

  // Tick the countdown so it updates smoothly in the UI.
  useEffect(() => {
    if (!heartsEnabled) return;
    if (!Number.isFinite(nextHeartInSecondsRaw)) return;
    if (hearts >= maxHearts) return;
    const id = window.setInterval(() => {
      setHeartTimerNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [hearts, heartsEnabled, maxHearts, nextHeartInSecondsRaw]);

  // When the countdown hits 0, refetch once so the backend applies regen and the UI resets.
  useEffect(() => {
    if (!heartsEnabled) return;
    if (!Number.isFinite(nextHeartInSecondsRaw)) return;
    if (hearts >= maxHearts) return;
    const ms = Math.max(250, Math.ceil(nextHeartInSecondsRaw * 1000) + 250);
    const id = window.setTimeout(() => {
      refetchHearts();
    }, ms);
    return () => window.clearTimeout(id);
  }, [hearts, heartsEnabled, maxHearts, nextHeartInSecondsRaw, refetchHearts]);

  useEffect(() => {
    if (!heartsEnabled) {
      setShowOutOfHearts(false);
      return;
    }
    if (hearts <= 0) {
      setShowOutOfHearts(true);
    }
  }, [hearts, heartsEnabled]);

  const normalizeSection = useCallback(
    (section, lessonId) => ({
      ...section,
      lessonId,
      text_content: section.text_content
        ? fixImagePaths(section.text_content)
        : "",
      video_url: section.video_url || "",
      exercise_data: section.exercise_data || {},
      order: section.order || 0,
      is_published:
        typeof section.is_published === "boolean" ? section.is_published : true,
    }),
    []
  );

  const normalizedLessons = useMemo(() => {
    return (lessonsData || []).map((lesson) => ({
      ...lesson,
      sections: (lesson.sections || [])
        .map((section) => normalizeSection(section, lesson.id))
        .sort((a, b) => a.order - b.order),
    }));
  }, [lessonsData, normalizeSection]);

  useEffect(() => {
    const completed = normalizedLessons
      .flatMap((lesson) => lesson.sections || [])
      .filter((section) => section.is_completed)
      .map((section) => section.id);
    setCompletedSectionIds(completed);
  }, [normalizedLessons]);

  useEffect(() => {
    const items = [];

    normalizedLessons.forEach((lesson, lessonIndex) => {
      const sections = (lesson.sections || []).filter(
        (s) => s && (s.is_published ?? true)
      );

      if (!sections.length) {
        // Fallback: treat a lesson without sections as one flow item.
        const detailed = fixImagePaths(lesson.detailed_content || "");
        items.push({
          key: `lesson-${lesson.id}`,
          kind: lesson.exercise_type ? "lesson-exercise" : "lesson-text",
          lessonId: lesson.id,
          lessonIndex,
          lessonTitle: lesson.title,
          lessonShortDescription: lesson.short_description,
          isCompleted: Boolean(lesson.is_completed),
          lessonExerciseType: lesson.exercise_type || null,
          lessonExerciseData: lesson.exercise_data || {},
          lessonDetailedContent: detailed,
        });
        return;
      }

      sections.forEach((section, sectionIndex) => {
        items.push({
          key: `section-${section.id}`,
          kind: "section",
          lessonId: lesson.id,
          lessonIndex,
          lessonTitle: lesson.title,
          lessonShortDescription: lesson.short_description,
          sectionIndex,
          section,
        });
      });
    });

    setFlowSections(items);
  }, [normalizedLessons]);

  useEffect(() => {
    if (didApplyInitialIndex) return;
    if (!flowSections.length) return;

    // If we attempted to fetch flow state (courseId is valid), wait until it completes.
    if (Number.isFinite(courseIdNumber) && !isFlowStateFetched) return;

    const saved = Number.isFinite(flowStateData?.current_index)
      ? flowStateData.current_index
      : null;

    if (saved !== null) {
      if (saved >= flowSections.length) {
        setCourseComplete(true);
        setCurrentIndex(Math.max(0, flowSections.length - 1));
      } else {
        setCourseComplete(false);
        setCurrentIndex(Math.max(0, Math.min(saved, flowSections.length - 1)));
      }
      setDidApplyInitialIndex(true);
      return;
    }

    // Fallback: Start at first incomplete item for nicer resume behavior.
    const firstIncompleteIndex = flowSections.findIndex((item) => {
      if (item.kind === "section") {
        return !item.section?.is_completed;
      }
      return !item.isCompleted;
    });
    setCourseComplete(false);
    setCurrentIndex(firstIncompleteIndex === -1 ? 0 : firstIncompleteIndex);
    setDidApplyInitialIndex(true);
  }, [
    courseIdNumber,
    didApplyInitialIndex,
    flowSections,
    flowStateData,
    isFlowStateFetched,
  ]);

  const completeSectionMutation = useMutation({
    mutationFn: completeSection,
    onSuccess: (_, sectionId) => {
      setCompletedSectionIds((prev) =>
        prev.includes(sectionId) ? prev : [...prev, sectionId]
      );
      queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
    },
    onError: () => toast.error("Failed to save progress. Please try again."),
  });

  const completeLessonMutation = useMutation({
    mutationFn: completeLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
    },
    onError: () => toast.error("Failed to save progress. Please try again."),
  });

  const decrementHeartsMutation = useMutation({
    mutationFn: () => decrementHearts(1).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["hearts"], data);
      if (data?.hearts <= 0) {
        setShowOutOfHearts(true);
      }
    },
  });

  const grantHeartsMutation = useMutation({
    mutationFn: (amount) => grantHearts(amount).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["hearts"], data);
      if (data?.hearts > 0) {
        setShowOutOfHearts(false);
      }
    },
  });

  const refillHeartsMutation = useMutation({
    mutationFn: () => refillHearts().then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["hearts"], data);
      setShowOutOfHearts(false);
    },
  });

  const totalSteps = flowSections.length || 1;
  const completedSteps = courseComplete
    ? totalSteps
    : Math.min(currentIndex, totalSteps);
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const currentItem = flowSections[currentIndex] || null;
  const isLast = currentIndex >= flowSections.length - 1;

  const isBlocked = heartsEnabled && hearts <= 0;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, Math.max(0, flowSections.length - 1));
      return next;
    });
  }, [flowSections.length]);

  const flowSaveTimerRef = useRef(null);
  const lastSavedFlowKeyRef = useRef(null);
  const lastQueuedFlowKeyRef = useRef(null);

  const persistFlowIndex = useCallback(
    async (indexOverride = null) => {
      if (!Number.isFinite(courseIdNumber) || !flowSections.length) return;
      const indexToSave =
        typeof indexOverride === "number"
          ? indexOverride
          : courseComplete
          ? flowSections.length
          : currentIndex;
      await saveCourseFlowState(courseIdNumber, indexToSave);
      lastSavedFlowKeyRef.current = `${courseIdNumber}:${indexToSave}`;
    },
    [courseComplete, courseIdNumber, currentIndex, flowSections.length]
  );

  useEffect(() => {
    if (!didApplyInitialIndex) return;
    if (!Number.isFinite(courseIdNumber)) return;
    if (!flowSections.length) return;

    const indexToSave = courseComplete ? flowSections.length : currentIndex;
    const key = `${courseIdNumber}:${indexToSave}`;

    // If we've already saved or already queued this exact value, do nothing.
    if (lastSavedFlowKeyRef.current === key) return;
    if (lastQueuedFlowKeyRef.current === key) return;

    if (flowSaveTimerRef.current) {
      clearTimeout(flowSaveTimerRef.current);
    }

    lastQueuedFlowKeyRef.current = key;
    flowSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveCourseFlowState(courseIdNumber, indexToSave);
        lastSavedFlowKeyRef.current = key;
      } catch {
        // ignore autosave errors
      } finally {
        // Only clear if nothing newer was queued.
        if (lastQueuedFlowKeyRef.current === key) {
          lastQueuedFlowKeyRef.current = null;
        }
      }
    }, 2000);

    return () => {
      if (flowSaveTimerRef.current) clearTimeout(flowSaveTimerRef.current);
    };
  }, [
    courseComplete,
    courseIdNumber,
    currentIndex,
    didApplyInitialIndex,
    flowSections.length,
  ]);

  const handleExit = async () => {
    try {
      await persistFlowIndex();
    } catch {
      // ignore
    } finally {
      navigate("/all-topics");
    }
  };

  const handleFinishCourse = async () => {
    try {
      await persistFlowIndex(flowSections.length);
    } catch {
      // ignore
    } finally {
      navigate(`/quiz/${courseId}`);
    }
  };

  const handleGoToPathCourses = async () => {
    try {
      await persistFlowIndex();
    } catch {
      // ignore
    } finally {
      if (Number.isFinite(pathIdNumber)) {
        navigate(`/courses/${pathIdNumber}`);
      } else {
        navigate("/all-topics");
      }
    }
  };

  const handleGoToAllTopicsPath = async () => {
    try {
      await persistFlowIndex();
    } catch {
      // ignore
    } finally {
      if (Number.isFinite(pathIdNumber)) {
        sessionStorage.setItem("scrollToPathId", String(pathIdNumber));
      }
      navigate("/all-topics");
    }
  };

  const otherCourses = useMemo(() => {
    const list = Array.isArray(pathCourses) ? pathCourses : [];
    return list.filter((c) => c?.id && c.id !== courseIdNumber);
  }, [courseIdNumber, pathCourses]);

  const handleGoToCourse = async (nextCourseId) => {
    if (!nextCourseId) return;
    try {
      await persistFlowIndex();
    } catch {
      // ignore
    }

    const destination = Number.isFinite(pathIdNumber)
      ? useImmersive
        ? `/courses/${pathIdNumber}/lessons/${nextCourseId}/flow`
        : `/courses/${pathIdNumber}/lessons/${nextCourseId}`
      : useImmersive
      ? `/lessons/${nextCourseId}/flow`
      : `/lessons/${nextCourseId}`;

    navigate(destination);
  };

  const handleAttempt = useCallback(
    ({ correct }) => {
      if (!heartsEnabled) return;
      if (correct) return;
      decrementHeartsMutation.mutate();
    },
    [decrementHeartsMutation, heartsEnabled]
  );

  const handleCompleteCurrent = useCallback(async () => {
    if (!currentItem) return;
    if (isBlocked) return;

    if (currentItem.kind === "section") {
      const sectionId = currentItem.section?.id;
      if (typeof sectionId === "number") {
        await completeSectionMutation.mutateAsync(sectionId);
      }
    } else {
      const lessonId = currentItem.lessonId;
      if (typeof lessonId === "number") {
        await completeLessonMutation.mutateAsync(lessonId);
      }
    }

    if (isLast) {
      setCourseComplete(true);
      return;
    }
    goNext();
  }, [
    completeLessonMutation,
    completeSectionMutation,
    currentItem,
    goNext,
    isBlocked,
    isLast,
    setCourseComplete,
  ]);

  const heartCountdownMs = useMemo(() => {
    if (!heartsEnabled) return null;
    if (!Number.isFinite(nextHeartInSecondsRaw)) return null;
    const elapsedSeconds = Math.floor(
      (heartTimerNowMs - heartsFetchedAtMs) / 1000
    );
    const remainingSeconds = Math.max(
      0,
      nextHeartInSecondsRaw - elapsedSeconds
    );
    return remainingSeconds * 1000;
  }, [
    heartTimerNowMs,
    heartsEnabled,
    heartsFetchedAtMs,
    nextHeartInSecondsRaw,
  ]);

  const headerText = useMemo(() => {
    if (!currentItem) return null;
    return {
      title: currentItem.lessonTitle || "Lesson",
      subtitle: currentItem.lessonShortDescription || "",
    };
  }, [currentItem]);

  const renderSectionBody = () => {
    if (!currentItem) return null;

    if (currentItem.kind === "section") {
      const section = currentItem.section;
      const isCompleted = completedSectionIds.includes(section.id);

      if (section.content_type === "text" && section.text_content) {
        return (
          <div
            className="prose max-w-none whitespace-pre-line text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--text-color,#111827)] prose-strong:text-[color:var(--primary,#1d5330)] dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: section.text_content }}
          />
        );
      }

      if (section.content_type === "video" && section.video_url) {
        const getYouTubeId = (url) => {
          const regExp =
            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
          const match = url.match(regExp);
          return match && match[2].length === 11 ? match[2] : null;
        };

        return (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-black/10 shadow-inner">
            <div className="aspect-video">
              {section.video_url.includes("youtube.com") ||
              section.video_url.includes("youtu.be") ? (
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(
                    section.video_url
                  )}`}
                  title={section.title}
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              ) : (
                <video controls className="h-full w-full">
                  <source src={section.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        );
      }

      if (section.content_type === "exercise" && section.exercise_data) {
        return (
          <div className="space-y-4">
            {section.exercise_type === "drag-and-drop" && (
              <DragAndDropExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked}
              />
            )}
            {section.exercise_type === "multiple-choice" && (
              <MultipleChoiceExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked}
              />
            )}
            {section.exercise_type === "budget-allocation" && (
              <BudgetAllocationExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked}
              />
            )}
            {section.text_content && (
              <div
                className="prose max-w-none text-[color:var(--muted-text,#6b7280)] dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: section.text_content }}
              />
            )}
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-5 py-5 text-sm text-[color:var(--muted-text,#6b7280)]">
          No content available for this section.
        </div>
      );
    }

    // lesson fallback item
    if (currentItem.kind === "lesson-exercise") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            This lesson uses a legacy “lesson-level” exercise format.
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-5 py-5 text-sm text-[color:var(--muted-text,#6b7280)]">
            Exercise type{" "}
            <span className="font-semibold">
              {currentItem.lessonExerciseType}
            </span>{" "}
            isn’t supported in the new flow yet.
          </div>
        </div>
      );
    }

    return (
      <div
        className="prose max-w-none text-[color:var(--text-color,#111827)] dark:prose-invert"
        dangerouslySetInnerHTML={{
          __html:
            currentItem.lessonDetailedContent || "No lesson content available.",
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)]">
        <div className="mx-auto w-full max-w-4xl px-6 pb-16 pt-24">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (shouldRedirectToCanonical && isCourseMetaLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)]">
        <div className="mx-auto w-full max-w-4xl px-6 pb-16 pt-24">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-5 py-6 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
            {error?.message ||
              "We couldn't load this course flow. Please try again."}
          </div>
          <button
            type="button"
            onClick={() => navigate("/all-topics")}
            className="mt-6 rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)]"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[color:var(--bg-color,#f8fafc)] flex flex-col">
      {/* Top bar */}
      <div className="flex-none border-b border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
          {/* X (left) */}
          <button
            type="button"
            onClick={handleExit}
            aria-label="Exit course"
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/70 px-3 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
          >
            ✕
          </button>

          {/* Progress (middle) */}
          <div className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-[560px]">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[color:var(--muted-text,#6b7280)]">
                <span>Progress</span>
                <span>
                  {completedSteps}/{totalSteps}
                </span>
              </div>
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${progressPercent}% complete`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/70 transition-[width] duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Hearts (right) */}
          <div className="flex min-w-[140px] items-center justify-end gap-3">
            <div
              className="flex items-center gap-1"
              aria-label={`Hearts: ${hearts} of ${maxHearts}`}
              role="status"
            >
              {Array.from({ length: maxHearts }).map((_, idx) => (
                <span key={idx} aria-hidden="true">
                  <HeartIcon filled={idx < hearts} />
                </span>
              ))}
            </div>
            <div className="hidden flex-col sm:flex items-end">
              <span className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                {hearts >= maxHearts
                  ? "Full"
                  : `Next in ${formatCountdown(heartCountdownMs)}`}
              </span>
              {hearts <= 1 && (
                <span className="text-[11px] text-rose-600">
                  Careful — hearts low
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content (scrolls internally; page stays fixed) */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-10">
          {courseComplete && (
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-8 text-center shadow-xl shadow-emerald-500/10">
              <h1 className="text-3xl font-bold text-emerald-900">
                Course complete
              </h1>
              <p className="mt-2 text-sm text-emerald-900/70">
                You&apos;ve completed all sections. Ready for the quiz?
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleFinishCourse}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:shadow-xl hover:shadow-emerald-600/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                >
                  Take the course quiz
                </button>
                <button
                  type="button"
                  onClick={handleExit}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-6 py-3 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          )}

          {!courseComplete && headerText && (
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
                {headerText.title}
              </h1>
              {headerText.subtitle && (
                <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
                  {headerText.subtitle}
                </p>
              )}
            </header>
          )}

          {!courseComplete &&
            currentItem?.kind === "section" &&
            currentItem.section?.title && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
                  {currentItem.section.title}
                </h2>
              </div>
            )}

          {!courseComplete && (
            <div className="space-y-8">{renderSectionBody()}</div>
          )}

          {/* Continue button for non-exercises */}
          {!courseComplete &&
            currentItem &&
            !isBlocked &&
            (currentItem.kind !== "section" ||
              currentItem.section?.content_type !== "exercise") && (
              <div className="mt-10 flex justify-end">
                <button
                  type="button"
                  onClick={handleCompleteCurrent}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/25 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/35 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                >
                  {isLast ? "Finish" : "Continue"}
                </button>
              </div>
            )}

          {!courseComplete && isBlocked && (
            <div className="mt-10 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-700">
              You&apos;re out of hearts. Regain a heart to continue.
            </div>
          )}

          {/* Progress + navigation (bottom of main section) */}
          {!courseComplete && (
            <section className="mt-12 rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/70 px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    Your progress
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--text-color,#111827)]">
                    <span className="font-semibold">{completedSteps}</span> of{" "}
                    <span className="font-semibold">{totalSteps}</span> sections
                    completed •{" "}
                    <span className="font-semibold">{progressPercent}%</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToAllTopicsPath}
                    className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
                  >
                    Back to path
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToPathCourses}
                    className="rounded-full border border-[color:var(--primary,#1d5330)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-xs font-semibold text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
                    disabled={!Number.isFinite(pathIdNumber)}
                    aria-disabled={!Number.isFinite(pathIdNumber)}
                  >
                    Other courses
                  </button>
                </div>
              </div>

              {Number.isFinite(pathIdNumber) && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    Jump to another course
                  </p>
                  {isPathCoursesLoading ? (
                    <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      Loading courses…
                    </div>
                  ) : otherCourses.length ? (
                    <div className="flex flex-wrap gap-2">
                      {otherCourses.slice(0, 8).map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => handleGoToCourse(course.id)}
                          className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-xs font-semibold text-[color:var(--text-color,#111827)] hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)]"
                          title={course.title}
                        >
                          {course.title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      No other courses found in this path.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Out of hearts modal */}
      {showOutOfHearts && !courseComplete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Out of hearts"
        >
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-white p-6 shadow-2xl shadow-black/25">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                  You&apos;re out of hearts
                </h3>
                <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                  Make a quick choice: practise to earn a heart, refill now, or
                  wait for regeneration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOutOfHearts(false)}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
                aria-label="Close out of hearts dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
              Next heart in{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {formatCountdown(heartCountdownMs)}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await grantHeartsMutation.mutateAsync(1);
                    toast.success("Practice complete — +1 heart");
                  } finally {
                    setShowOutOfHearts(false);
                  }
                }}
                disabled={grantHeartsMutation.isPending}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--primary,#1d5330)] bg-white px-5 py-2 text-sm font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
              >
                Practise (+1 heart)
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refillHeartsMutation.mutateAsync();
                    toast.success("Hearts refilled");
                  } finally {
                    setShowOutOfHearts(false);
                  }
                }}
                disabled={refillHeartsMutation.isPending}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/25"
              >
                Refill hearts
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseFlowPage;
