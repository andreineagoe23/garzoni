import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "../styles/LessonPage.module.css";
import Chatbot from "./Chatbot";
import DragAndDropExercise from "./DragAndDropExercise";
import UserProgressBox from "./UserProgressBox";

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
  const [showProgress, setShowProgress] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/lessons/with_progress/?course=${courseId}`,
          { withCredentials: true }
        );

        const lessonsWithSections = response.data.map((lesson) => ({
          ...lesson,
          sections: (lesson.sections || [])
            .map((section) => ({
              ...section,
              text_content: section.text_content ? fixImagePaths(section.text_content) : "",
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
  }, [courseId]);

  useEffect(() => {
    if (lessons.length > 0 && completedLessons.length === lessons.length) {
      setCourseCompleted(true);
    }
  }, [lessons, completedLessons]);

  const handleCompleteSection = async (sectionId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/userprogress/complete-section/`,
        { section_id: sectionId },
        { withCredentials: true }
      );
      setCompletedSections((prev) => [...prev, sectionId]);
    } catch (err) {
      console.error("Failed to complete section:", err);
    }
  };

  const handleCompleteLesson = async (lessonId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/lessons/complete/`,
        { lesson_id: lessonId },
        { withCredentials: true }
      );

      setCompletedLessons((prev) => [...prev, lessonId]);
      setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
      setTimeout(() => setSuccessMessage(""), 3000);
      setSelectedLesson(null);
      setActiveTab(0);
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
      <div className={styles.sectionContent}>
        {section.content_type === "text" && section.text_content && (
          <div
            className={styles.textContent}
            dangerouslySetInnerHTML={{ __html: section.text_content }}
          />
        )}

        {section.content_type === "video" && section.video_url && (
          <div className={styles.videoContainer}>
            {section.video_url.includes("youtube.com") ||
            section.video_url.includes("youtu.be") ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(section.video_url)}`}
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
          <div className={styles.exerciseContainer}>
            <DragAndDropExercise
              data={section.exercise_data}
              exerciseId={section.id}
              onComplete={() => handleCompleteSection(section.id)}
              isCompleted={isCompleted}
            />
            {section.text_content && (
              <div
                className={styles.exerciseInstructions}
                dangerouslySetInnerHTML={{ __html: section.text_content }}
              />
            )}
          </div>
        )}

        {isCompleted && (
          <div className={styles.completionBadge}>✓ Section Completed</div>
        )}
      </div>
    );
  };

  const getYouTubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const renderLessonContent = (lesson) => {
    const hasSections = lesson.sections?.length > 0;
    const currentSection = lesson.sections?.[activeTab];
    const isLastTab = activeTab === (lesson.sections?.length || 0) - 1;

    return (
      <div className={styles.lessonContent}>
        {hasSections && (
          <div className={styles.tabContainer}>
            {lesson.sections.map((section, index) => (
              <button
                key={section.id || index}
                className={`${styles.tab} ${
                  activeTab === index ? styles.activeTab : ""
                } button button--secondary`}
                onClick={() => setActiveTab(index)}
              >
                {section.title || `Section ${index + 1}`}
                {completedSections.includes(section.id) && (
                  <span className={styles.completedIndicator}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className={styles.tabContent}>
          {hasSections ? (
            currentSection ? (
              renderSectionContent(currentSection)
            ) : (
              <p>No content available for this section</p>
            )
          ) : (
            <div
              dangerouslySetInnerHTML={{
                __html: fixImagePaths(lesson.detailed_content) || "No lesson content available",
              }}
            />
          )}
        </div>

        {hasSections && (
          <div className={styles.tabControls}>
            {activeTab > 0 && (
              <button
                className="button button--secondary"
                onClick={() => setActiveTab((prev) => prev - 1)}
              >
                Previous
              </button>
            )}

            {!isLastTab ? (
              <button
                className="button button--secondary"
                onClick={() => setActiveTab((prev) => prev + 1)}
              >
                Next
              </button>
            ) : (
              <div className={styles.lessonCompletion}>
                {!lesson.is_completed && (
                  <button
                    className="button button--primary"
                    onClick={() => handleCompleteLesson(lesson.id)}
                  >
                    Complete Lesson
                  </button>
                )}
                <p className={styles.endMessage}>
                  You've reached the end of this lesson
                </p>
              </div>
            )}
          </div>
        )}

        {!hasSections && lesson.exercise_type && (
          <div className={styles.exerciseContainer}>
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

  if (loading) return <div className={styles.loading}>Loading lessons...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.lessonLayout}>
      <div className={styles.lessonMain}>
        {successMessage && (
          <div className={styles.successMessage}>{successMessage}</div>
        )}

        <div className={styles.lessonBox}>
          {lessons.length > 0 ? (
            lessons.map((lesson, index) => {
              const isCompleted = completedLessons.includes(lesson.id);
              const isAccessible = index === 0 || completedLessons.includes(lessons[index - 1]?.id);

              return (
                <div
                  key={lesson.id}
                  className={`${styles.lessonBoxItem} ${
                    isCompleted
                      ? styles.completed
                      : isAccessible
                      ? styles.incomplete
                      : styles.locked
                  }`}
                >
                  <h4 onClick={() => isAccessible && handleLessonClick(lesson.id)}>
                    {lesson.title}
                  </h4>
                  <p>{lesson.short_description}</p>

                  {selectedLesson === lesson.id && isAccessible && renderLessonContent(lesson)}
                </div>
              );
            })
          ) : (
            <p>No lessons available for this course.</p>
          )}
        </div>

        {courseCompleted && (
          <div className={styles.courseCompletion}>
            <h3>Congratulations! You've completed the course.</h3>
            <button className="button button--primary" onClick={handleCourseCompletion}>
              Take the Course Quiz
            </button>
          </div>
        )}

        <Chatbot />
      </div>

      <div className={styles.lessonProgress}>
        <UserProgressBox />
      </div>

      <button
        className="button button--secondary floatingProgressBtn"
        onClick={() => setShowProgress((p) => !p)}
      >
        Progress
      </button>

      {showProgress && (
        <div className={styles.progressPanel}>
          <button
            className="button button--secondary"
            onClick={() => setShowProgress(false)}
          >
            Close
          </button>
          <UserProgressBox />
        </div>
      )}
    </div>
  );
}

export default LessonPage;