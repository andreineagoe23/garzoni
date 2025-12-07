import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import DragAndDropExercise from "components/exercises/DragAndDropExercise";
import UserProgressBox from "components/widgets/UserProgressBox";
import MultipleChoiceExercise from "components/exercises/MultipleChoiceExercise";
import BudgetAllocationExercise from "components/exercises/BudgetAllocationExercise";
import PageContainer from "components/common/PageContainer";
import Breadcrumbs from "components/common/Breadcrumbs";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { GlassButton, GlassCard } from "components/ui";
import LessonSectionEditorPanel from "./LessonSectionEditorPanel";
import Skeleton from "components/common/Skeleton";
import {
  completeLesson,
  completeSection,
  createLessonSection,
  deleteLessonSection,
  fetchExercises,
  fetchLessonsWithProgress,
  fetchProgressSummary,
  reorderLessonSections,
  updateLessonSection,
} from "services/userService";
import { attachToken } from "services/httpClient";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function fixImagePaths(content) {
  if (!content) return "";
  const mediaUrl = `${BACKEND_URL}/media/`;
  return content.replace(/src="\/media\/([^"]+)"/g, (_, filename) => {
    return `src="${mediaUrl}${filename}"`;
  });
}

  function LessonPage() {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [lessons, setLessons] = useState([]);
    const [error, setError] = useState(null);
    const [completedLessons, setCompletedLessons] = useState([]);
    const [completedSections, setCompletedSections] = useState([]);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");
    const [courseCompleted, setCourseCompleted] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const { getAccessToken } = useAuth();
    const { adminMode } = useAdmin();
    const [editingLessonId, setEditingLessonId] = useState(null);
    const [editingSectionId, setEditingSectionId] = useState(null);
    const [draftSection, setDraftSection] = useState(null);
    const [saveState, setSaveState] = useState({ status: "idle", message: "" });
    const [pendingAutosave, setPendingAutosave] = useState(false);
    const lessonsRef = useRef([]);
    const queryClient = useQueryClient();

    useEffect(() => {
      lessonsRef.current = lessons;
    }, [lessons]);

    useEffect(() => {
      attachToken(getAccessToken());
    }, [getAccessToken]);

    const normalizeSection = useCallback(
      (section, lessonId) => ({
        ...section,
        lessonId,
        text_content: section.text_content ? fixImagePaths(section.text_content) : "",
        video_url: section.video_url || "",
        exercise_data: section.exercise_data || {},
        order: section.order || 0,
        is_published:
          typeof section.is_published === "boolean" ? section.is_published : true,
      }),
      []
    );

    const normalizeLessons = useCallback(
      (lessonList) =>
        (lessonList || []).map((lesson) => ({
          ...lesson,
          sections: (lesson.sections || [])
            .map((section) => normalizeSection(section, lesson.id))
            .sort((a, b) => a.order - b.order),
        })),
      [normalizeSection]
    );

    const {
      data: lessonsData,
      isLoading: isLessonsLoading,
      error: lessonsError,
    } = useQuery({
      queryKey: ["lessons", courseId, adminMode],
      queryFn: () => fetchLessonsWithProgress(courseId, adminMode),
      select: (response) => response.data || [],
    });

    const { data: progressData } = useQuery({
      queryKey: ["progress-summary"],
      queryFn: () => fetchProgressSummary().then((response) => response.data),
    });

    const { data: exercisesData, isLoading: loadingExercises } = useQuery({
      queryKey: ["exercises"],
      queryFn: () => fetchExercises().then((response) => response.data || []),
      enabled: adminMode,
    });

    useEffect(() => {
      if (!lessonsData) return;

      const lessonsWithSections = normalizeLessons(lessonsData);
      lessonsRef.current = lessonsWithSections;
      setLessons(lessonsWithSections);
      setCompletedLessons(
        lessonsWithSections
          .filter((lesson) => lesson.is_completed)
          .map((lesson) => lesson.id)
      );

      const completed = lessonsWithSections
        .flatMap((lesson) => lesson.sections || [])
        .filter((section) => section.is_completed)
        .map((section) => section.id);
      setCompletedSections(completed);
      setError(null);
    }, [lessonsData, normalizeLessons]);

  useEffect(() => {
    if (lessons.length > 0 && completedLessons.length === lessons.length) {
      setCourseCompleted(true);
    }
  }, [lessons, completedLessons]);

    const snapshotLessons = useCallback(
      () =>
        lessonsRef.current.map((lesson) => ({
          ...lesson,
          sections: (lesson.sections || []).map((section) => ({ ...section })),
        })),
      []
    );

    const updateLessonSections = useCallback((lessonId, updater) => {
      setLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, sections: updater(lesson.sections || []) }
            : lesson
        )
      );
    }, []);

    const exercises = exercisesData || [];

    const completeSectionMutation = useMutation({
      mutationFn: completeSection,
      onSuccess: (_, sectionId) => {
        setCompletedSections((prev) =>
          prev.includes(sectionId) ? prev : [...prev, sectionId]
        );
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      },
      onError: () =>
        toast.error("Failed to complete section. Please try again."),
    });

    const completeLessonMutation = useMutation({
      mutationFn: completeLesson,
      onSuccess: (_, lessonId) => {
        setCompletedLessons((prev) =>
          prev.includes(lessonId) ? prev : [...prev, lessonId]
        );
        setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
        setTimeout(() => setSuccessMessage(""), 3000);
        setSelectedLesson(null);
        setActiveTab(0);
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
      },
      onError: () => setError("Failed to complete lesson. Please try again."),
    });

  const handleOfflineSave = useCallback(() => {
    if (!lessons.length) return;
    localStorage.setItem(
      `offline-lessons-${courseId}`,
      JSON.stringify({ lessons })
    );
    toast.success("Lessons saved for offline review.");
  }, [courseId, lessons]);

  const beginEditingSection = (lessonId, section) => {
    setEditingLessonId(lessonId);
    setEditingSectionId(section?.id || null);
    setDraftSection(section ? { ...section, lessonId } : null);
    setPendingAutosave(false);
    setSaveState({ status: "idle", message: "" });
  };

  const updateDraftSection = (updates) => {
    let didUpdate = false;
    setDraftSection((previous) => {
      if (!previous) return previous;
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
    async (sectionPayload, { silent = false } = {}) => {
      if (!sectionPayload?.lessonId || typeof sectionPayload.id !== "number") {
        return;
      }

      setSaveState({
        status: "saving",
        message: silent ? "" : "Saving changes...",
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

        const normalized = normalizeSection(response.data, sectionPayload.lessonId);
        updateLessonSections(sectionPayload.lessonId, (sections) =>
          sections.map((section) =>
            section.id === normalized.id ? normalized : section
          )
        );
        setDraftSection(normalized);
        setSaveState({ status: "saved", message: silent ? "" : "Saved" });
      } catch (err) {
        console.error("Failed to save section", err);
        setSaveState({
          status: "error",
          message: "Could not save changes.",
        });
      }
    },
    [normalizeSection, updateLessonSections]
  );

  const handleAddSection = async (lessonId) => {
    const tempId = `temp-${Date.now()}`;
    const previousSnapshot = snapshotLessons();
    const existingSections =
      lessonsRef.current.find((lesson) => lesson.id === lessonId)?.sections || [];

    const newSection = {
      id: tempId,
      lessonId,
      title: "New section",
      content_type: "text",
      text_content: "",
      video_url: "",
      exercise_type: "",
      exercise_data: {},
      order: existingSections.length + 1,
      is_published: false,
    };

    updateLessonSections(lessonId, (sections) =>
      [...sections, newSection].sort((a, b) => a.order - b.order)
    );
    beginEditingSection(lessonId, newSection);

      try {
        const response = await createLessonSection(lessonId, newSection);
        const normalized = normalizeSection(response.data, lessonId);
        updateLessonSections(lessonId, (sections) =>
          sections.map((section) => (section.id === tempId ? normalized : section))
        );
        setDraftSection(normalized);
      setEditingSectionId(normalized.id);
    } catch (err) {
      console.error("Failed to create section", err);
      setLessons(previousSnapshot);
      setSaveState({ status: "error", message: "Could not create section." });
      beginEditingSection(null, null);
    }
  };

  const handleDeleteSection = async (lessonId, sectionId) => {
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
      setSaveState({ status: "error", message: "Failed to delete section." });
    }
  };

  const handleReorderSection = async (lessonId, sectionId, direction) => {
    const previousSnapshot = snapshotLessons();
    const lesson = lessonsRef.current.find((item) => item.id === lessonId);

    if (!lesson) return;

    const sections = (lesson.sections || []).map((section) => ({ ...section }));
    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const offset = direction === "up" ? -1 : 1;
    const targetIndex = currentIndex + offset;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sections.length) {
      return;
    }

    [sections[currentIndex], sections[targetIndex]] = [
      sections[targetIndex],
      sections[currentIndex],
    ];

    const reordered = sections.map((section, index) => ({
      ...section,
      order: index + 1,
    }));

    updateLessonSections(lessonId, () => reordered);
    setActiveTab(targetIndex);

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
        message: "Could not update ordering.",
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

    const handleCompleteSection = (sectionId) => {
      completeSectionMutation.mutate(sectionId);
    };

    const handleCompleteLesson = (lessonId) => {
      completeLessonMutation.mutate(lessonId);
    };

  const handleCourseCompletion = () => {
    navigate(`/quiz/${courseId}`);
  };

  const handleLessonClick = (lessonId) => {
    setSelectedLesson((prev) => (prev === lessonId ? null : lessonId));
    setActiveTab(0);
  };

  const getYouTubeId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const renderSectionContent = (section) => {
    const isCompleted = completedSections.includes(section.id);
    const isDraft = !section.is_published;

    return (
      <div className="space-y-6">
        {adminMode && isDraft && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Draft - hidden from learners
          </div>
        )}
        {section.content_type === "text" && section.text_content && (
          <div
            className="prose max-w-none whitespace-pre-line text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--text-color,#111827)] prose-strong:text-[color:var(--primary,#1d5330)] dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: section.text_content }}
          />
        )}

        {section.content_type === "video" && section.video_url && (
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
        )}

        {section.content_type === "exercise" && section.exercise_data && (
          <div className="space-y-4 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f8fafc)] p-6 shadow-inner shadow-black/5">
            {section.exercise_type === "drag-and-drop" && (
              <DragAndDropExercise
                data={section.exercise_data}
                exerciseId={section.id}
                onComplete={() => handleCompleteSection(section.id)}
                isCompleted={isCompleted}
              />
            )}
            {section.exercise_type === "multiple-choice" && (
              <MultipleChoiceExercise
                data={section.exercise_data}
                onComplete={() => handleCompleteSection(section.id)}
                isCompleted={isCompleted}
              />
            )}
            {section.exercise_type === "budget-allocation" && (
              <BudgetAllocationExercise
                data={section.exercise_data}
                onComplete={() => handleCompleteSection(section.id)}
                isCompleted={isCompleted}
              />
            )}
            {section.text_content && (
              <div
                className="prose max-w-none text-[color:var(--muted-text,#6b7280)] dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: section.text_content }}
              />
            )}
          </div>
        )}

        {isCompleted && (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">
            ✓ Section Completed
          </div>
        )}
      </div>
    );
  };

  const renderLessonContent = (lesson) => {
    const hasSections = lesson.sections?.length > 0;
    const currentSection = lesson.sections?.[activeTab];
    const isLastTab = activeTab === (lesson.sections?.length || 0) - 1;
    const isEditingCurrent =
      adminMode &&
      editingLessonId === lesson.id &&
      editingSectionId === currentSection?.id;
    const showEditorForLesson = adminMode && editingLessonId === lesson.id;

    const content = (
      <div className="space-y-6">
        {hasSections && (
          <div className="flex flex-wrap items-center gap-2">
            {lesson.sections.map((section, index) => (
              <button
                key={section.id || index}
                type="button"
                className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-sm focus:ring-[color:var(--primary,#1d5330)]/40 ${
                  activeTab === index
                    ? "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40"
                    : "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-[color:var(--primary,#1d5330)]/10 hover:text-[color:var(--primary,#1d5330)]"
                }`}
                onClick={() => setActiveTab(index)}
              >
                <span>{section.title || `Section ${index + 1}`}</span>
                {completedSections.includes(section.id) && (
                  <span className="text-xs text-emerald-300">✓</span>
                )}
                {adminMode && !section.is_published && (
                  <span className="text-[10px] uppercase text-amber-400">Draft</span>
                )}
              </button>
            ))}
          </div>
        )}

        {adminMode && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              onClick={() => handleAddSection(lesson.id)}
            >
              Add section
            </button>
            {currentSection && (
              <>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 ${
                    isEditingCurrent
                      ? "border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)] text-white"
                      : "border border-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)] hover:text-[color:var(--primary,#1d5330)]"
                  }`}
                  onClick={() =>
                    beginEditingSection(lesson.id, {
                      ...currentSection,
                      lessonId: lesson.id,
                    })
                  }
                >
                  {isEditingCurrent ? "Editing" : "Edit section"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)]"
                  disabled={activeTab === 0}
                  onClick={() =>
                    handleReorderSection(lesson.id, currentSection.id, "up")
                  }
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)]"
                  disabled={activeTab >= (lesson.sections?.length || 0) - 1}
                  onClick={() =>
                    handleReorderSection(lesson.id, currentSection.id, "down")
                  }
                >
                  Move down
                </button>
              </>
            )}
          </div>
        )}

        <GlassCard padding="lg">
          {hasSections ? (
            currentSection ? (
              renderSectionContent(currentSection)
            ) : (
              <p>No content available for this section.</p>
            )
          ) : (
            <div
              className="prose max-w-none text-[color:var(--text-color,#111827)] dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html:
                  fixImagePaths(lesson.detailed_content) ||
                  "No lesson content available.",
              }}
            />
          )}
        </GlassCard>

        {hasSections && (
          <div className="flex items-center justify-between">
            {activeTab > 0 ? (
              <button
                type="button"
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                onClick={() => setActiveTab((prev) => prev - 1)}
              >
                Previous
              </button>
            ) : (
              <span />
            )}

            {!isLastTab ? (
              <button
                type="button"
                className="rounded-full border border-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                onClick={() => setActiveTab((prev) => prev + 1)}
              >
                Next
              </button>
            ) : (
              <div className="flex items-center gap-4">
                {!lesson.is_completed && (
                  <button
                    type="button"
                    className="rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                    onClick={() => handleCompleteLesson(lesson.id)}
                  >
                    Complete Lesson
                  </button>
                )}
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  You&apos;ve reached the end of this lesson.
                </p>
              </div>
            )}
          </div>
        )}

        {!hasSections && lesson.exercise_type && (
          <GlassCard padding="lg" className="bg-[color:var(--input-bg,#f8fafc)]/60">
            {lesson.exercise_type === "drag-and-drop" ? (
              <DragAndDropExercise
                data={lesson.exercise_data}
                exerciseId={lesson.id}
                onComplete={() => handleCompleteLesson(lesson.id)}
              />
            ) : (
              <p>Exercise type not supported.</p>
            )}
          </GlassCard>
        )}
      </div>
    );

    if (!adminMode) {
      return content;
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.15fr)_minmax(320px,1fr)]">
        {content}
        <LessonSectionEditorPanel
          section={showEditorForLesson ? draftSection : null}
          onChange={updateDraftSection}
          onDelete={() =>
            draftSection && handleDeleteSection(lesson.id, draftSection.id)
          }
          onPublishToggle={handlePublishToggle}
          onSave={handleManualSave}
          savingState={saveState}
          exercises={exercises}
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
          currentSectionTitle={currentSection?.title}
        />
      </div>
    );
  };

    const queryErrorMessage =
      lessonsError?.response?.data?.detail ||
      lessonsError?.response?.data?.error ||
      lessonsError?.message;
    const displayError = error || queryErrorMessage;

    if (isLessonsLoading) {
      return (
        <PageContainer maxWidth="7xl" layout="centered">
          <div className="w-full space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </PageContainer>
    );
  }

    if (displayError) {
      return (
        <PageContainer maxWidth="7xl">
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-5 py-6 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
            {displayError}
          </div>
        </PageContainer>
      );
  }

  return (
    <PageContainer
      maxWidth="7xl"
      layout="none"
      innerClassName="grid w-full grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]"
    >
      <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Breadcrumbs
              items={[
                { label: "Dashboard", to: "/all-topics" },
                { label: "Course Lessons" },
              ]}
            />
            <GlassButton variant="ghost" onClick={handleOfflineSave}>
              Save lessons offline
            </GlassButton>
          </div>
          {successMessage && (
            <div className="rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200 shadow-inner shadow-emerald-500/20">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            {lessons.length > 0 ? (
              lessons.map((lesson, index) => {
                const isCompleted = completedLessons.includes(lesson.id);
                const previousLessonId = lessons[index - 1]?.id;
                const isAccessible =
                  index === 0 || completedLessons.includes(previousLessonId);

                return (
                  <article
                    key={lesson.id}
                    className={`space-y-4 rounded-3xl border px-6 py-6 shadow-xl transition ${
                      isCompleted
                        ? "border-emerald-400/40 bg-emerald-500/5 shadow-emerald-500/10"
                        : isAccessible
                        ? "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] shadow-black/5"
                        : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/60 opacity-70"
                    }`}
                  >
                    <header className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                          {lesson.title}
                        </h4>
                        <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                          {lesson.short_description}
                        </p>
                      </div>
                      {isCompleted ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">
                          Completed
                        </span>
                      ) : !isAccessible ? (
                        <span className="rounded-full bg-[color:var(--muted-text,#6b7280)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full border border-[color:var(--primary,#1d5330)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                          onClick={() => handleLessonClick(lesson.id)}
                        >
                          {selectedLesson === lesson.id ? "Hide" : "View"}
                        </button>
                      )}
                    </header>

                    {selectedLesson === lesson.id && isAccessible && (
                      <div className="border-t border-[color:var(--border-color,#d1d5db)] pt-6">
                        {renderLessonContent(lesson)}
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-6 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
                No lessons available for this course.
              </p>
            )}
          </div>

          {courseCompleted && (
            <div className="rounded-3xl border border-emerald-400/60 bg-emerald-500/10 px-6 py-6 text-center text-sm text-emerald-200 shadow-xl shadow-emerald-500/20">
              <h3 className="text-lg font-semibold text-emerald-100">
                Congratulations! You've completed the course.
              </h3>
              <p className="mt-2 text-emerald-200/80">
                Test your knowledge with the final quiz.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                onClick={handleCourseCompletion}
              >
                Take the Course Quiz
              </button>
            </div>
          )}

        </div>

      <aside className="space-y-4 lg:pl-2">
        <div className="sticky top-[90px]">
          {progressData ? (
            <UserProgressBox progressData={progressData} />
          ) : (
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Loading progress...
            </p>
          )}
        </div>
      </aside>
    </PageContainer>
  );
}

export default LessonPage;

