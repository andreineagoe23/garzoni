import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Chatbot from "components/widgets/Chatbot";
import DragAndDropExercise from "components/exercises/DragAndDropExercise";
import UserProgressBox from "components/widgets/UserProgressBox";
import MultipleChoiceExercise from "components/exercises/MultipleChoiceExercise";
import BudgetAllocationExercise from "components/exercises/BudgetAllocationExercise";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

function fixImagePaths(content) {
  if (!content) return "";
  const mediaUrl = `${process.env.REACT_APP_BACKEND_URL}/media/`;
  return content.replace(/src="\/media\/([^"]+)"/g, (_, filename) => {
    return `src="${mediaUrl}${filename}"`;
  });
}

function LessonPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [completedSections, setCompletedSections] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [userProgress, setUserProgress] = useState(null);
  const { getAccessToken } = useAuth();

  const fetchUserProgress = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/userprogress/progress_summary/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setUserProgress(response.data);
    } catch (err) {
      console.error("Error fetching user progress:", err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/lessons/with_progress/?course=${courseId}`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        const lessonsWithSections = response.data.map((lesson) => ({
          ...lesson,
          sections: (lesson.sections || [])
            .map((section) => ({
              ...section,
              text_content: section.text_content
                ? fixImagePaths(section.text_content)
                : "",
              video_url: section.video_url || "",
              exercise_data: section.exercise_data || {},
              order: section.order || 0,
            }))
            .sort((a, b) => a.order - b.order),
        }));

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
      } catch (err) {
        setError("Failed to load lessons. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
    fetchUserProgress();
  }, [courseId, getAccessToken, fetchUserProgress]);

  useEffect(() => {
    if (lessons.length > 0 && completedLessons.length === lessons.length) {
      setCourseCompleted(true);
    }
  }, [lessons, completedLessons]);

  const handleCompleteSection = async (sectionId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/userprogress/complete_section/`,
        { section_id: sectionId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      setCompletedSections((prev) => [...prev, sectionId]);
      fetchUserProgress();
    } catch (err) {
      console.error("Failed to complete section:", err);
    }
  };

  const handleCompleteLesson = async (lessonId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/userprogress/complete/`,
        { lesson_id: lessonId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      setCompletedLessons((prev) => [...prev, lessonId]);
      setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
      setTimeout(() => setSuccessMessage(""), 3000);
      setSelectedLesson(null);
      setActiveTab(0);
      fetchUserProgress();
    } catch (err) {
      setError("Failed to complete lesson. Please try again.");
    }
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

    return (
      <div className="space-y-6">
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

    return (
      <div className="space-y-6">
        {hasSections && (
          <div className="flex flex-wrap gap-2">
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
              </button>
            ))}
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
  };

  if (loading) {
    return (
      <PageContainer maxWidth="7xl" layout="centered">
        <div className="flex items-center gap-3 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--primary,#1d5330)] border-t-transparent" />
          Loading lessons...
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="7xl">
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-5 py-6 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
          {error}
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

        <Chatbot />
      </div>

      <aside className="space-y-4 lg:pl-2">
        <div className="sticky top-[90px]">
          {userProgress ? (
            <UserProgressBox progressData={userProgress} />
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

