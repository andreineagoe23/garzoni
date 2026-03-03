import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import DOMPurify from "dompurify";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { useHearts } from "hooks/useHearts";
import { useProgress } from "hooks/useProgress";
import { calculatePercent } from "utils/progress";
import { queryKeys, staleTimes } from "lib/reactQuery";
import {
  completeLesson,
  completeSection,
  createLessonSection,
  deleteLessonSection,
  fetchCourseFlowState,
  fetchLearningPathCourses,
  fetchLessonsWithProgress,
  fetchExercises,
  reorderLessonSections,
  saveCourseFlowState,
  updateLessonSection,
} from "services/userService";
import { attachToken } from "services/httpClient";
import { BACKEND_URL } from "services/backendUrl";
import MultipleChoiceExercise from "components/exercises/MultipleChoiceExercise";
import DragAndDropExercise from "components/exercises/DragAndDropExercise";
import BudgetAllocationExercise from "components/exercises/BudgetAllocationExercise";
import FillInTableExercise from "components/exercises/FillInTableExercise";
import ScenarioSimulationExercise from "components/exercises/ScenarioSimulationExercise";
import MascotMedia from "components/common/MascotMedia";
import MascotWithMessage from "components/common/MascotWithMessage";
import LessonSectionEditorPanel, {
  type LessonSection,
} from "./LessonSectionEditorPanel";
import Skeleton from "components/common/Skeleton";
import { usePreferences } from "hooks/usePreferences";
import { GlassButton } from "components/ui";

type CourseFlowSection = {
  id: number | string;
  section?: string;
  kind?: string;
  content_type?: string;
  text_content?: string;
  video_url?: string;
  exercise_type?: string;
  exercise_data?: Record<string, unknown>;
  order?: number;
  is_completed?: boolean;
  lessonId?: number;
  lessonDetailedContent?: string;
  lessonTitle?: string;
  lessonShortDescription?: string;
  is_published?: boolean;
  title?: string;
  [key: string]: unknown;
};

type CourseFlowLesson = {
  id: number;
  title?: string;
  short_description?: string;
  detailed_content?: string;
  exercise_type?: string;
  exercise_data?: Record<string, unknown>;
  is_completed?: boolean;
  sections: CourseFlowSection[];
  is_published?: boolean;
  [key: string]: unknown;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

type FlowItem =
  | {
      key: string;
      kind: "section";
      lessonId: number;
      lessonIndex: number;
      lessonTitle?: string;
      lessonShortDescription?: string;
      sectionIndex: number;
      section: CourseFlowSection;
    }
  | {
      key: string;
      kind: "lesson-text" | "lesson-exercise";
      lessonId: number;
      lessonIndex: number;
      lessonTitle?: string;
      lessonShortDescription?: string;
      isCompleted: boolean;
      lessonExerciseType?: string | null;
      lessonExerciseData?: Record<string, unknown>;
      lessonDetailedContent?: string;
    };

function formatCountdown(ms: number) {
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

function HeartIcon({ filled }: { filled: boolean }) {
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

function fixImagePaths(content: string) {
  if (!content) return "";
  const mediaUrl = `${BACKEND_URL}/media/`;
  return content.replace(
    /src="\/media\/([^"]+)"/g,
    (_: string, filename: string) => {
      return `src="${mediaUrl}${filename}"`;
    }
  );
}

function CourseFlowPage() {
  const { t } = useTranslation();
  const { courseId, pathId } = useParams();
  const courseIdNumber = useMemo(
    () => Number.parseInt(courseId ?? "0", 10),
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
  const { adminMode } = useAdmin();
  const { setCourseFlowProgress, resetCourseFlowProgress } = useProgress();

  const [lessons, setLessons] = useState<CourseFlowLesson[]>([]);
  const lessonsRef = useRef<CourseFlowLesson[]>([]);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<
    number | string | null
  >(null);
  const [draftSection, setDraftSection] = useState<CourseFlowSection | null>(
    null
  );
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [pendingAutosave, setPendingAutosave] = useState(false);

  const [flowSections, setFlowSections] = useState<FlowItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSectionIds, setCompletedSectionIds] = useState<
    (number | string)[]
  >([]);
  const [courseComplete, setCourseComplete] = useState(false);

  const heartsEnabled = preferences?.heartsEnabled !== false;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [didApplyInitialIndex, setDidApplyInitialIndex] = useState(false);
  const {
    refetchHearts,
    hearts,
    maxHearts,
    nextHeartInSecondsRaw,
    isOutOfHeartsModalOpen,
    setOutOfHeartsModalOpen,
    outOfHeartsUntilTs,
    lastSeenServerHeartsTs,
    decrementHeart,
    grantHeartsSafe,
    refillHeartsSafe,
    decrementHeartsMutation,
    grantHeartsMutation,
    refillHeartsMutation,
  } = useHearts({ enabled: heartsEnabled, refetchIntervalMs: 30_000 });

  const isHeartsMutating =
    decrementHeartsMutation.isPending ||
    grantHeartsMutation.isPending ||
    refillHeartsMutation.isPending;

  useEffect(() => {
    lessonsRef.current = lessons;
  }, [lessons]);

  useEffect(() => {
    setDidApplyInitialIndex(false);
    setCourseComplete(false);
    setCurrentIndex(0);
    setOutOfHeartsModalOpen(false);
    resetCourseFlowProgress();
    setEditingLessonId(null);
    setEditingSectionId(null);
    setDraftSection(null);
  }, [courseIdNumber, resetCourseFlowProgress, setOutOfHeartsModalOpen]);

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

  const {
    data: lessonsData,
    isLoading,
    error,
  } = useQuery<CourseFlowLesson[], Error>({
    queryKey: queryKeys.lessonsWithProgress(
      courseIdNumber,
      adminMode ? "admin" : "learner"
    ),
    queryFn: async () => {
      const response = await fetchLessonsWithProgress(
        courseIdNumber,
        adminMode
      );
      return response.data || [];
    },
    enabled: Number.isFinite(courseIdNumber) && courseIdNumber > 0,
  });

  const { data: exercisesData, isLoading: loadingExercises } = useQuery<
    {
      data?: Array<{
        id?: number;
        type?: string;
        exercise_data?: Record<string, unknown>;
      }>;
    },
    Error
  >({
    queryKey: queryKeys.exercises(),
    queryFn: () => fetchExercises().then((response) => response.data || []),
    enabled: adminMode,
    staleTime: staleTimes.content,
  });

  const exercises = exercisesData || [];

  const normalizeSection = useCallback(
    (section: CourseFlowSection, lessonId: number): CourseFlowSection => ({
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

  const normalizeLessons = useCallback(
    (lessonList: CourseFlowLesson[]) =>
      (lessonList || []).map((lesson: CourseFlowLesson) => ({
        ...lesson,
        sections: (lesson.sections || [])
          .map((section: CourseFlowSection) =>
            normalizeSection(section, lesson.id)
          )
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
      })),
    [normalizeSection]
  );

  useEffect(() => {
    if (!lessonsData) return;

    const normalized = normalizeLessons(lessonsData);
    lessonsRef.current = normalized;
    setLessons(normalized);
    const completed = normalized
      .flatMap((lesson) => lesson.sections || [])
      .filter(
        (section): section is CourseFlowSection & { id: number } =>
          section.is_completed === true && typeof section.id === "number"
      )
      .map((section) => section.id);
    setCompletedSectionIds(completed);
  }, [lessonsData, normalizeLessons]);

  const { data: flowStateData, isFetched: isFlowStateFetched } = useQuery({
    queryKey: queryKeys.courseFlow(courseIdNumber),
    queryFn: () => fetchCourseFlowState(courseIdNumber).then((r) => r.data),
    enabled: Number.isFinite(courseIdNumber),
  });

  const { data: pathCourses, isLoading: isPathCoursesLoading } = useQuery({
    queryKey: queryKeys.learningPathCourses(pathIdNumber),
    queryFn: () =>
      fetchLearningPathCourses(pathIdNumber).then(
        (response) => response.data?.data || response.data || []
      ),
    enabled: Number.isFinite(pathIdNumber),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: staleTimes.content,
  });

  // Tick the countdown so it updates smoothly in the UI (local-only).
  useEffect(() => {
    if (!heartsEnabled) return;
    if (!Number.isFinite(nextHeartInSecondsRaw)) return;
    if (hearts >= maxHearts) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
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
    const items: FlowItem[] = [];

    lessons.forEach((lesson, lessonIndex) => {
      const sections = (lesson.sections || []).filter((section) => {
        if (!section) return false;
        if (adminMode) return true;
        return section.is_published ?? true;
      });

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
  }, [adminMode, lessons]);

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
      const normalizedId = Number(sectionId);
      if (!Number.isFinite(normalizedId)) {
        return;
      }
      setCompletedSectionIds((prev) =>
        prev.includes(normalizedId) ? prev : [...prev, normalizedId]
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.progressSummary() });
    },
    onError: () => toast.error(t("courses.flow.saveProgressFailed")),
  });

  const completeLessonMutation = useMutation({
    mutationFn: completeLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.progressSummary() });
    },
    onError: () => toast.error(t("courses.flow.saveProgressFailed")),
  });

  const totalSteps = flowSections.length || 1;
  const completedSteps = courseComplete
    ? totalSteps
    : Math.min(currentIndex, totalSteps);
  const progressPercent = calculatePercent(completedSteps, totalSteps, {
    round: true,
  });

  useEffect(() => {
    setCourseFlowProgress({
      courseId: courseIdNumber,
      currentIndex,
      totalSteps,
      percent: progressPercent,
      courseComplete,
    });
  }, [
    courseComplete,
    courseIdNumber,
    currentIndex,
    progressPercent,
    setCourseFlowProgress,
    totalSteps,
  ]);

  const currentItem = flowSections[currentIndex] || null;
  const isLast = currentIndex >= flowSections.length - 1;

  const isBlocked = !adminMode && heartsEnabled && hearts <= 0;

  const snapshotLessons = useCallback(
    () =>
      lessonsRef.current.map((lesson) => ({
        ...lesson,
        sections: (lesson.sections || []).map((section) => ({ ...section })),
      })),
    []
  );

  const updateLessonSections = useCallback(
    (
      lessonId: number,
      updater: (sections: CourseFlowSection[]) => CourseFlowSection[]
    ) => {
      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, sections: updater(lesson.sections || []) }
            : lesson
        )
      );
    },
    []
  );

  const beginEditingSection = (
    lessonId: number | null,
    section: CourseFlowSection | null
  ) => {
    setEditingLessonId(lessonId);
    setEditingSectionId(section?.id ?? null);
    setDraftSection(
      section ? { ...section, lessonId: lessonId ?? undefined } : null
    );
    setPendingAutosave(false);
    setSaveState({ status: "idle", message: "" });
  };

  const updateDraftSection = (updates: Partial<CourseFlowSection>) => {
    let didUpdate = false;
    setDraftSection((previous) => {
      if (!previous || previous.lessonId === undefined) return previous;
      didUpdate = true;
      const next = { ...previous, ...updates };
      updateLessonSections(previous.lessonId, (sections) =>
        sections.map((section) =>
          section.id === previous.id ? { ...section, ...updates } : section
        )
      );
      return next;
    });
    if (didUpdate) {
      setPendingAutosave(true);
    }
  };

  const saveSectionToServer = useCallback(
    async (
      sectionPayload: CourseFlowSection,
      { silent = false }: { silent?: boolean } = {}
    ) => {
      if (!sectionPayload?.lessonId || typeof sectionPayload.id !== "number") {
        return;
      }

      setSaveState({
        status: "saving",
        message: silent ? "" : t("courses.flow.savingChanges"),
      });

      try {
        const response = await updateLessonSection(
          sectionPayload.lessonId,
          sectionPayload.id,
          {
            title: sectionPayload.title,
            content_type: sectionPayload.content_type,
            text_content: sectionPayload.text_content,
            video_url: sectionPayload.video_url,
            exercise_type: sectionPayload.exercise_type,
            exercise_data: sectionPayload.exercise_data,
            is_published: sectionPayload.is_published,
            order: sectionPayload.order,
          }
        );

        const normalized = normalizeSection(
          response.data,
          sectionPayload.lessonId
        );
        updateLessonSections(sectionPayload.lessonId, (sections) =>
          sections.map((section) =>
            section.id === normalized.id ? normalized : section
          )
        );
        setDraftSection(normalized);
        setSaveState({
          status: "saved",
          message: silent ? "" : t("shared.saved"),
        });
      } catch (err) {
        console.error("Failed to save section", err);
        setSaveState({
          status: "error",
          message: t("courses.flow.couldNotSaveChanges"),
        });
      }
    },
    [normalizeSection, updateLessonSections]
  );

  const handleAddSection = async (lessonId: number) => {
    const tempId = `temp-${Date.now()}`;
    const previousSnapshot = snapshotLessons();
    const existingSections =
      lessonsRef.current.find((lesson) => lesson.id === lessonId)?.sections ||
      [];

    const newSection = {
      id: tempId,
      lessonId,
      title: t("courses.flow.newSection"),
      content_type: "text",
      text_content: "",
      video_url: "",
      exercise_type: "",
      exercise_data: {},
      order: existingSections.length + 1,
      is_published: false,
    };

    updateLessonSections(lessonId, (sections) =>
      [...sections, newSection].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );
    beginEditingSection(lessonId, newSection);

    try {
      const response = await createLessonSection(lessonId, newSection);
      const normalized = normalizeSection(response.data, lessonId);
      updateLessonSections(lessonId, (sections) =>
        sections.map((section) =>
          section.id === tempId ? normalized : section
        )
      );
      setDraftSection(normalized);
      setEditingSectionId(normalized.id);
    } catch (err) {
      console.error("Failed to create section", err);
      setLessons(previousSnapshot);
      setSaveState({
        status: "error",
        message: t("courses.flow.couldNotCreateSection"),
      });
      beginEditingSection(null, null);
    }
  };

  const handleDeleteSection = async (
    lessonId: number,
    sectionId: number | string
  ) => {
    const previousSnapshot = snapshotLessons();
    updateLessonSections(lessonId, (sections) =>
      sections.filter((section) => section.id !== sectionId)
    );

    try {
      await deleteLessonSection(lessonId, sectionId);

      if (editingSectionId === sectionId) {
        beginEditingSection(null, null);
      }
    } catch (err) {
      console.error("Failed to delete section", err);
      setLessons(previousSnapshot);
      setSaveState({
        status: "error",
        message: t("courses.flow.failedToDeleteSection"),
      });
    }
  };

  const handleReorderSection = async (
    lessonId: number,
    sectionId: number | string,
    direction: "up" | "down"
  ) => {
    const previousSnapshot = snapshotLessons();
    const lesson = lessonsRef.current.find((item) => item.id === lessonId);

    if (!lesson) return;

    const sections = (lesson.sections || []).map((section) => ({ ...section }));
    const currentIndexInLesson = sections.findIndex(
      (section) => section.id === sectionId
    );
    const offset = direction === "up" ? -1 : 1;
    const targetIndex = currentIndexInLesson + offset;

    if (
      currentIndexInLesson === -1 ||
      targetIndex < 0 ||
      targetIndex >= sections.length
    ) {
      return;
    }

    [sections[currentIndexInLesson], sections[targetIndex]] = [
      sections[targetIndex],
      sections[currentIndexInLesson],
    ];

    const reordered = sections.map((section, index) => ({
      ...section,
      order: index + 1,
    }));

    updateLessonSections(lessonId, () => reordered);

    try {
      await reorderLessonSections(
        lessonId,
        reordered.map((section) => section.id)
      );
    } catch (err) {
      console.error("Failed to reorder sections", err);
      setLessons(previousSnapshot);
      setSaveState({
        status: "error",
        message: t("courses.flow.couldNotUpdateOrdering"),
      });
    }
  };

  const handleManualSave = () => {
    if (draftSection && typeof draftSection.id === "number") {
      saveSectionToServer(draftSection);
    }
  };

  const handlePublishToggle = () => {
    if (draftSection) {
      updateDraftSection({ is_published: !draftSection.is_published });
    }
  };

  useEffect(() => {
    if (!adminMode || !draftSection || typeof draftSection.id !== "number") {
      return undefined;
    }

    if (!pendingAutosave) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setPendingAutosave(false);
      saveSectionToServer(draftSection, { silent: true });
    }, 900);

    return () => clearTimeout(timer);
  }, [adminMode, draftSection, pendingAutosave, saveSectionToServer]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, Math.max(0, flowSections.length - 1));
      return next;
    });
  }, [flowSections.length]);

  const flowSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedFlowKeyRef = useRef<string | null>(null);
  const lastQueuedFlowKeyRef = useRef<string | null>(null);

  const persistFlowIndex = useCallback(
    async (indexOverride: number | null = null) => {
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

  // If the flow length changes (publish toggle, delete, reorder), keep the index valid.
  useEffect(() => {
    setCurrentIndex((prev) => {
      if (!flowSections.length) return 0;
      return Math.max(0, Math.min(prev, flowSections.length - 1));
    });
  }, [flowSections.length]);

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

  const nextCourseIdInPath = useMemo(() => {
    if (!Number.isFinite(pathIdNumber)) return null;
    const list = Array.isArray(pathCourses) ? pathCourses : [];
    const index = list.findIndex((course) => course?.id === courseIdNumber);
    if (index === -1) return null;
    return list[index + 1]?.id ?? null;
  }, [courseIdNumber, pathCourses, pathIdNumber]);

  const handleGoToCourse = useCallback(
    async (nextCourseId: number, flowIndexOverride: number | null = null) => {
      if (!nextCourseId) return;
      try {
        if (typeof flowIndexOverride === "number") {
          await persistFlowIndex(flowIndexOverride);
        } else {
          await persistFlowIndex();
        }
      } catch {
        // ignore
      }

      const destination = Number.isFinite(pathIdNumber)
        ? `/courses/${pathIdNumber}/lessons/${nextCourseId}/flow`
        : `/lessons/${nextCourseId}/flow`;

      navigate(destination);
    },
    [navigate, pathIdNumber, persistFlowIndex]
  );

  const mascotTimeoutRef = useRef<number | null>(null);
  const mascotInteractionCountRef = useRef(0);
  const [mascotMood, setMascotMood] = useState<
    "neutral" | "celebrate" | "encourage"
  >("neutral");
  const pulseMascot = useCallback((nextMood: "celebrate" | "encourage") => {
    if (mascotTimeoutRef.current) {
      window.clearTimeout(mascotTimeoutRef.current);
    }
    mascotInteractionCountRef.current += 1;
    setMascotMood(nextMood);
    mascotTimeoutRef.current = window.setTimeout(() => {
      setMascotMood("neutral");
    }, 3500);
  }, []);

  const handleAttempt = useCallback(
    ({ correct }: { correct: boolean }) => {
      if (!adminMode && heartsEnabled && !correct) {
        decrementHeart();
      }
      pulseMascot(correct ? "celebrate" : "encourage");
    },
    [adminMode, decrementHeart, heartsEnabled, pulseMascot]
  );

  useEffect(() => {
    return () => {
      if (mascotTimeoutRef.current) {
        window.clearTimeout(mascotTimeoutRef.current);
      }
    };
  }, []);

  const handleNavigateForward = useCallback(() => {
    if (isLast) {
      if (nextCourseIdInPath) {
        handleGoToCourse(nextCourseIdInPath, flowSections.length);
        return;
      }
      setCourseComplete(true);
      return;
    }
    goNext();
  }, [
    goNext,
    handleGoToCourse,
    isLast,
    nextCourseIdInPath,
    flowSections.length,
    setCourseComplete,
  ]);

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

    pulseMascot("celebrate");
    handleNavigateForward();
  }, [
    completeLessonMutation,
    completeSectionMutation,
    currentItem,
    handleNavigateForward,
    isBlocked,
    pulseMascot,
  ]);

  const heartCountdownMs = useMemo(() => {
    if (!heartsEnabled) return null;
    if (!Number.isFinite(nextHeartInSecondsRaw)) return null;
    if (hearts >= maxHearts) return 0;

    // If we're out of hearts, prefer the cross-tab synced "blocked until" timestamp.
    if (
      hearts <= 0 &&
      outOfHeartsUntilTs !== null &&
      Number.isFinite(outOfHeartsUntilTs)
    ) {
      return Math.max(0, outOfHeartsUntilTs - nowMs);
    }

    // Otherwise compute based on when we last saw the server payload.
    if (
      lastSeenServerHeartsTs !== null &&
      Number.isFinite(lastSeenServerHeartsTs)
    ) {
      const targetTs =
        lastSeenServerHeartsTs + Math.ceil(nextHeartInSecondsRaw * 1000);
      return Math.max(0, targetTs - nowMs);
    }

    // Fallback (no server timestamp yet): just render the raw value.
    return Math.max(0, Math.ceil(nextHeartInSecondsRaw * 1000));
  }, [
    heartsEnabled,
    hearts,
    lastSeenServerHeartsTs,
    maxHearts,
    nowMs,
    nextHeartInSecondsRaw,
    outOfHeartsUntilTs,
  ]);

  const currentLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === currentItem?.lessonId) || null,
    [currentItem?.lessonId, lessons]
  );

  const currentLessonSections = currentLesson?.sections || [];
  const currentSectionIndex = currentLessonSections.findIndex(
    (section) =>
      section.id ===
      (currentItem?.kind === "section" ? currentItem.section?.id : undefined)
  );
  const currentSection =
    currentItem?.kind === "section" ? currentItem.section : null;

  const sanitizedSectionHtml = useMemo(() => {
    if (!currentItem || currentItem.kind !== "section") return null;
    const content = currentItem.section?.text_content;
    return content ? DOMPurify.sanitize(content) : null;
  }, [currentItem]);

  const sanitizedLessonDetailHtml = useMemo(() => {
    if (!currentItem || currentItem.kind === "section") return null;
    return DOMPurify.sanitize(
      currentItem.lessonDetailedContent || t("courses.flow.noLessonContent")
    );
  }, [currentItem]);

  const headerText = useMemo(() => {
    if (!currentItem) return null;
    return {
      title: currentItem.lessonTitle || t("courses.flow.lessonFallback"),
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
            dangerouslySetInnerHTML={{
              __html: sanitizedSectionHtml || "",
            }}
          />
        );
      }

      if (section.content_type === "video" && section.video_url) {
        const getYouTubeId = (url: string) => {
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
                  {t("courses.flow.videoNotSupported")}
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
                disabled={isBlocked || isHeartsMutating}
              />
            )}
            {section.exercise_type === "multiple-choice" && (
              <MultipleChoiceExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked || isHeartsMutating}
              />
            )}
            {section.exercise_type === "budget-allocation" && (
              <BudgetAllocationExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked || isHeartsMutating}
              />
            )}
            {section.exercise_type === "fill-in-table" && (
              <FillInTableExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked || isHeartsMutating}
              />
            )}
            {section.exercise_type === "scenario-simulation" && (
              <ScenarioSimulationExercise
                data={section.exercise_data}
                exerciseId={section.id}
                isCompleted={isCompleted}
                onAttempt={handleAttempt}
                onComplete={handleCompleteCurrent}
                disabled={isBlocked || isHeartsMutating}
              />
            )}
            {section.text_content && (
              <div
                className="prose max-w-none text-[color:var(--muted-text,#6b7280)] dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: sanitizedSectionHtml || "",
                }}
              />
            )}
          </div>
        );
      }

      return (
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-5 py-5 text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("courses.flow.noSectionContent")}
        </div>
      );
    }

    // lesson fallback item
    if (currentItem.kind === "lesson-exercise") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            {t("courses.flow.legacyExerciseFormat")}
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-5 py-5 text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("courses.flow.unsupportedExerciseType", {
              type: currentItem.lessonExerciseType,
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        className="prose max-w-none text-[color:var(--text-color,#111827)] dark:prose-invert"
        dangerouslySetInnerHTML={{
          __html: sanitizedLessonDetailHtml || "",
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

  if (error) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-5 py-6 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
            {error?.message || t("courses.flow.loadError")}
          </div>
          <button
            type="button"
            onClick={() => navigate("/all-topics")}
            className="mt-6 rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)]"
          >
            {t("courses.flow.backToDashboard")}
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
            aria-label={t("courses.flow.exitCourse")}
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/70 px-3 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/50 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
          >
            ✕
          </button>

          {/* Progress (middle) */}
          <div className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-[560px]">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[color:var(--muted-text,#6b7280)]">
                <span>{t("shared.progress")}</span>
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
                aria-label={t("courses.flow.progressAria", {
                  percent: progressPercent,
                })}
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
              aria-label={t("courses.flow.heartsAria", {
                hearts,
                max: maxHearts,
              })}
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
                  ? t("courses.flow.full")
                  : t("courses.flow.nextIn", {
                      time: formatCountdown(heartCountdownMs),
                    })}
              </span>
              {hearts <= 1 && (
                <span className="text-[11px] text-rose-600">
                  {t("courses.flow.heartsLow")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content (scrolls internally; page stays fixed) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-5xl px-6 pb-24 pt-10">
          {courseComplete && (
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-8 text-center shadow-xl shadow-emerald-500/10">
              <div className="flex flex-col items-center gap-3">
                <MascotMedia
                  mascot="owl"
                  className="h-24 w-24 object-contain"
                />
                <p className="text-sm text-emerald-900/80">
                  {t("courses.flow.courseCompleteMascot")}
                </p>
              </div>
              <h1 className="mt-4 text-3xl font-bold text-emerald-900">
                {t("courses.flow.courseComplete")}
              </h1>
              <p className="mt-2 text-sm text-emerald-900/70">
                {t("courses.flow.courseCompleteSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {nextCourseIdInPath ? (
                  <GlassButton
                    variant="active"
                    size="xl"
                    onClick={() =>
                      handleGoToCourse(nextCourseIdInPath, flowSections.length)
                    }
                  >
                    {t("courses.flow.nextCourse")}
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="active"
                    size="xl"
                    onClick={handleFinishCourse}
                  >
                    {t("courses.flow.takeQuiz")}
                  </GlassButton>
                )}
                <GlassButton variant="ghost" size="xl" onClick={handleExit}>
                  {t("courses.flow.backToDashboard")}
                </GlassButton>
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
            adminMode &&
            !currentItem.section?.is_published && (
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(var(--accent-rgb,255,215,0),0.35)] bg-[color:rgba(var(--accent-rgb,255,215,0),0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#FFD700)]">
                  {t("courses.flow.draftHidden")}
                </span>
              </div>
            )}

          {adminMode && currentItem?.kind === "section" && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => handleAddSection(currentItem.lessonId)}
              >
                {t("courses.flow.addSection")}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() =>
                  beginEditingSection(currentItem.lessonId, currentItem.section)
                }
              >
                {t("courses.flow.editSection")}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleReorderSection(
                    currentItem.lessonId,
                    currentItem.section.id,
                    "up"
                  )
                }
                disabled={currentSectionIndex <= 0}
              >
                {t("courses.flow.moveUp")}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() =>
                  handleReorderSection(
                    currentItem.lessonId,
                    currentItem.section.id,
                    "down"
                  )
                }
                disabled={
                  currentSectionIndex === -1 ||
                  currentSectionIndex >= currentLessonSections.length - 1
                }
              >
                {t("courses.flow.moveDown")}
              </GlassButton>
              <GlassButton
                size="sm"
                variant="danger"
                onClick={() =>
                  handleDeleteSection(
                    currentItem.lessonId,
                    currentItem.section.id
                  )
                }
              >
                {t("shared.delete")}
              </GlassButton>
            </div>
          )}

          {!courseComplete && (
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="flex-1 space-y-8">{renderSectionBody()}</div>
              <aside className="w-full lg:w-64">
                <div className="sticky top-6">
                  <MascotWithMessage
                    mood={mascotMood}
                    rotateMessages
                    rotationKey={mascotInteractionCountRef.current}
                    mascotClassName="h-28 w-28 object-contain"
                  />
                </div>
              </aside>
            </div>
          )}

          {!courseComplete && currentItem && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              <GlassButton
                variant="ghost"
                size="lg"
                onClick={() => {
                  if (currentIndex <= 0) {
                    handleGoToPathCourses();
                    return;
                  }
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
              >
                {currentIndex <= 0
                  ? Number.isFinite(pathIdNumber)
                    ? t("courses.flow.backToCourses")
                    : t("courses.flow.backToDashboard")
                  : t("shared.back")}
              </GlassButton>

              {!isBlocked && (
                <GlassButton
                  variant="active"
                  size="xl"
                  disabled={
                    isHeartsMutating ||
                    completeLessonMutation.isPending ||
                    completeSectionMutation.isPending
                  }
                  onClick={() => {
                    // For exercises, just navigate forward without marking complete
                    const isExercise =
                      currentItem.kind === "section" &&
                      currentItem.section?.content_type === "exercise";
                    if (isExercise) {
                      handleNavigateForward();
                    } else {
                      handleCompleteCurrent();
                    }
                  }}
                >
                  {isLast
                    ? nextCourseIdInPath
                      ? t("courses.flow.nextCourse")
                      : t("shared.finish")
                    : t("shared.continue")}
                </GlassButton>
              )}
            </div>
          )}

          {!courseComplete && isBlocked && (
            <div className="mt-10 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-700">
              {t("courses.flow.outOfHearts")}
            </div>
          )}

          {/* Progress + navigation (bottom of main section) */}
          {!courseComplete && (
            <section className="mt-12 rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/70 px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {t("courses.flow.yourProgress")}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--text-color,#111827)]">
                    {t("courses.flow.sectionsCompleted", {
                      completed: completedSteps,
                      total: totalSteps,
                      percent: progressPercent,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGoToAllTopicsPath}
                    className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
                  >
                    {t("courses.flow.backToPath")}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToPathCourses}
                    className="rounded-full border border-[color:var(--primary,#1d5330)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-xs font-semibold text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
                    disabled={!Number.isFinite(pathIdNumber)}
                    aria-disabled={!Number.isFinite(pathIdNumber)}
                  >
                    {t("courses.flow.otherCourses")}
                  </button>
                </div>
              </div>

              {Number.isFinite(pathIdNumber) && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {t("courses.flow.jumpToCourse")}
                  </p>
                  {isPathCoursesLoading ? (
                    <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      {t("courses.flow.loadingCourses")}
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
                      {t("courses.flow.noOtherCourses")}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {adminMode && (draftSection || editingLessonId) && (
        <div
          className="fixed inset-0 z-[1400] bg-[color:var(--bg-color,#f8fafc)]/92 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("courses.flow.lessonSectionEditor")}
        >
          <div className="relative h-full w-full">
            <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => beginEditingSection(null, null)}
                aria-label={t("courses.flow.closeEditor")}
              >
                ✕
              </GlassButton>
            </div>

            <div className="h-full w-full overflow-hidden p-4 sm:p-6">
              <LessonSectionEditorPanel
                section={draftSection as LessonSection | null}
                onChange={
                  updateDraftSection as (
                    updates: Partial<LessonSection>
                  ) => void
                }
                onDelete={() => {
                  if (!draftSection || draftSection.lessonId === undefined)
                    return;
                  handleDeleteSection(draftSection.lessonId, draftSection.id);
                }}
                onPublishToggle={handlePublishToggle}
                onSave={handleManualSave}
                savingState={saveState}
                exercises={
                  Array.isArray(exercises) ? exercises : exercises?.data || []
                }
                loadingExercises={loadingExercises}
                onExerciseAttach={(exercise) => {
                  if (!exercise) return;
                  updateDraftSection({
                    content_type: "exercise",
                    exercise_type: exercise.type,
                    exercise_data: exercise.exercise_data || {},
                  });
                }}
                onCloseRequest={() => beginEditingSection(null, null)}
                currentSectionTitle={
                  draftSection?.title || currentSection?.title
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Out of hearts modal */}
      {isOutOfHeartsModalOpen && !courseComplete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("courses.flow.outOfHeartsModalTitle")}
        >
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-white p-6 shadow-2xl shadow-black/25">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                  {t("courses.flow.outOfHeartsModalTitle")}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("courses.flow.outOfHeartsModalSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOutOfHeartsModalOpen(false)}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
                aria-label={t("courses.flow.closeOutOfHearts")}
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("courses.flow.nextHeartIn")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {formatCountdown(heartCountdownMs)}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await grantHeartsSafe(1);
                    toast.success(t("courses.flow.practiceCompleteHeart"));
                  } finally {
                    setOutOfHeartsModalOpen(false);
                  }
                }}
                disabled={isHeartsMutating}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--primary,#1d5330)] bg-white px-5 py-2 text-sm font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white"
              >
                {t("courses.flow.practiseHeart")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refillHeartsSafe();
                    toast.success(t("courses.flow.heartsRefilled"));
                  } finally {
                    setOutOfHeartsModalOpen(false);
                  }
                }}
                disabled={isHeartsMutating}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/25"
              >
                {t("courses.flow.refillHearts")}
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)]"
              >
                {t("courses.flow.backToDashboard")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseFlowPage;
