import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Chatbot from "./Chatbot";
import DragAndDropExercise from "./DragAndDropExercise";
import UserProgressBox from "./UserProgressBox";
import MultipleChoiceExercise from "./MultipleChoiceExercise";
import BudgetAllocationExercise from "./BudgetAllocationExercise";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

function fixImagePaths(content) {
  if (!content) return "";
  const mediaUrl = process.env.REACT_APP_BACKEND_URL + "/media/";
  return content.replace(/src="\/media\/([^"]+)"/g, (match, p1) => {
    return `src="${mediaUrl}${p1}"`;
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
  const [showProgress] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [userProgress, setUserProgress] = useState(null);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchLessons = async () => {
      try {
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
            .map((l) => l.id)
        );

        const completed = response.data
          .flatMap((lesson) => lesson.sections || [])
          .filter((section) => section.is_completed)
          .map((s) => s.id);
        setCompletedSections(completed);
      } catch (err) {
        setError("Failed to load lessons. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
    fetchUserProgress();
  }, [courseId, getAccessToken]);

  // Extract fetchUserProgress to a separate function for reuse
  const fetchUserProgress = async () => {
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
    } catch (error) {
      console.error("Error fetching user progress:", error);
    }
  };

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

      // Update local state
      setCompletedSections((prev) => [...prev, sectionId]);

      // Refresh progress data
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

      // Update completed lessons in local state
      setCompletedLessons((prev) => [...prev, lessonId]);

      // Show success message
      setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Reset lesson view
      setSelectedLesson(null);
      setActiveTab(0);

      // Immediately fetch updated progress to reflect changes
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

  const renderSectionContent = (section) => {
    const isCompleted = completedSections.includes(section.id);

    return (
      <div className="section-content">
        {section.content_type === "text" && section.text_content && (
          <div
            className="text-content"
            dangerouslySetInnerHTML={{ __html: section.text_content }}
          />
        )}

        {section.content_type === "video" && section.video_url && (
          <div className="video-container">
            {section.video_url.includes("youtube.com") ||
            section.video_url.includes("youtu.be") ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(
                  section.video_url
                )}`}
                title={section.title}
                allowFullScreen
              />
            ) : (
              <video controls>
                <source src={section.video_url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        )}

        {section.content_type === "exercise" && section.exercise_data && (
          <div className="exercise-container">
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
                className="exercise-instructions"
                dangerouslySetInnerHTML={{ __html: section.text_content }}
              />
            )}
          </div>
        )}

        {isCompleted && (
          <div className="completion-badge">✓ Section Completed</div>
        )}
      </div>
    );
  };

  const getYouTubeId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const renderLessonContent = (lesson) => {
    const hasSections = lesson.sections?.length > 0;
    const currentSection = lesson.sections?.[activeTab];
    const isLastTab = activeTab === (lesson.sections?.length || 0) - 1;

    return (
      <div className="lesson-content">
        {hasSections && (
          <div className="tab-container">
            {lesson.sections.map((section, index) => (
              <button
                key={section.id || index}
                className={`tab ${activeTab === index ? "active-tab" : ""}`}
                onClick={() => setActiveTab(index)}
              >
                {section.title || `Section ${index + 1}`}
                {completedSections.includes(section.id) && (
                  <span className="completed-indicator">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="tab-content">
          {hasSections ? (
            currentSection ? (
              renderSectionContent(currentSection)
            ) : (
              <p>No content available for this section</p>
            )
          ) : (
            <div
              dangerouslySetInnerHTML={{
                __html:
                  fixImagePaths(lesson.detailed_content) ||
                  "No lesson content available",
              }}
            />
          )}
        </div>

        {hasSections && (
          <div className="tab-controls">
            {activeTab > 0 && (
              <button
                className="btn btn-accent"
                onClick={() => setActiveTab((prev) => prev - 1)}
              >
                Previous
              </button>
            )}

            {!isLastTab ? (
              <button
                className="btn btn-outline-accent"
                onClick={() => setActiveTab((prev) => prev + 1)}
              >
                Next
              </button>
            ) : (
              <div className="lesson-completion">
                {!lesson.is_completed && (
                  <button
                    className="btn btn-accent"
                    onClick={() => handleCompleteLesson(lesson.id)}
                  >
                    Complete Lesson
                  </button>
                )}
                <p className="end-message">
                  You've reached the end of this lesson
                </p>
              </div>
            )}
          </div>
        )}

        {!hasSections && lesson.exercise_type && (
          <div className="exercise-container">
            {lesson.exercise_type === "drag-and-drop" ? (
              <DragAndDropExercise
                data={lesson.exercise_data}
                exerciseId={lesson.id}
                onComplete={() => handleCompleteLesson(lesson.id)}
              />
            ) : (
              <p>Exercise type not supported</p>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="loading">Loading lessons...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="lesson-page">
      <div className="lesson-main">
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="lesson-box">
          {lessons.length > 0 ? (
            lessons.map((lesson, index) => {
              const isCompleted = completedLessons.includes(lesson.id);
              const isAccessible =
                index === 0 ||
                completedLessons.includes(lessons[index - 1]?.id);

              return (
                <div
                  key={lesson.id}
                  className={`lesson-box-item ${
                    isCompleted
                      ? "completed"
                      : isAccessible
                      ? "incomplete"
                      : "locked"
                  }`}
                >
                  <h4
                    onClick={() => isAccessible && handleLessonClick(lesson.id)}
                  >
                    {lesson.title}
                  </h4>
                  <p>{lesson.short_description}</p>

                  {selectedLesson === lesson.id &&
                    isAccessible &&
                    renderLessonContent(lesson)}
                </div>
              );
            })
          ) : (
            <p>No lessons available for this course.</p>
          )}
        </div>

        {courseCompleted && (
          <div className="course-completion">
            <h3>Congratulations! You've completed the course.</h3>
            <button className="btn btn-accent" onClick={handleCourseCompletion}>
              Take the Course Quiz
            </button>
          </div>
        )}

        <Chatbot />
      </div>

      <div className={`lesson-progress ${showProgress ? "show" : ""}`}>
        {userProgress ? (
          <UserProgressBox progressData={userProgress} />
        ) : (
          <p>Loading progress...</p>
        )}
      </div>
    </div>
  );
}

export default LessonPage;
