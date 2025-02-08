import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "../styles/LessonPage.module.css";
import Chatbot from "./Chatbot";
import DragAndDropExercise from "./DragAndDropExercise";
import UserProgressBox from "./UserProgressBox";

function fixImagePaths(content) {
  const mediaUrl = "http://localhost:8000/media/";
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
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [courseCompleted, setCourseCompleted] = useState(false);

  // NEW: For mobile, toggles the slide-in panel
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/lessons/with_progress/?course=${courseId}`,
          { withCredentials: true } // ✅ Use cookies instead of localStorage
        );
        const lessonsWithProgress = response.data;
        setLessons(lessonsWithProgress);
        setCompletedLessons(
          lessonsWithProgress
            .filter((lesson) => lesson.is_completed)
            .map((l) => l.id)
        );
      } catch (err) {
        console.error("Failed to fetch lessons:", err);
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

  const handleCompleteLesson = async (lessonId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/lessons/complete/`,
        { lesson_id: lessonId },
        { withCredentials: true } // ✅ Use cookies for authentication
      );

      setCompletedLessons((prev) => [...prev, lessonId]);
      setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
      setTimeout(() => setSuccessMessage(""), 3000);
      setSelectedLesson(null);
    } catch (err) {
      console.error("Failed to complete lesson:", err);
      setError("Failed to complete lesson. Please try again.");
    }
  };

  const handleCourseCompletion = () => {
    navigate(`/quiz/${courseId}`);
  };

  const handleLessonClick = (lessonId) => {
    setSelectedLesson((prev) => (prev === lessonId ? null : lessonId));
  };

  const renderExercise = (exerciseType, exerciseData, lessonId) => {
    if (!exerciseData || Object.keys(exerciseData).length === 0) {
      return <p>No exercise available for this lesson.</p>;
    }

    switch (exerciseType) {
      case "drag-and-drop":
        return (
          <DragAndDropExercise data={exerciseData} exerciseId={lessonId} />
        );
      default:
        return <p>No exercise available for this lesson.</p>;
    }
  };

  if (loading) return <p>Loading lessons...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className={styles.lessonLayout}>
      {/* LEFT: Main Lesson Content */}
      <div className={styles.lessonMain}>
        {successMessage && (
          <p className={styles.successMessage}>{successMessage}</p>
        )}

        <div className={styles.lessonBox}>
          {lessons.length > 0 ? (
            lessons.map((lesson, index) => {
              const isCompleted = completedLessons.includes(lesson.id);
              const isAccessible =
                index === 0 ||
                completedLessons.includes(lessons[index - 1]?.id);

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
                  <h4 onClick={() => handleLessonClick(lesson.id)}>
                    {lesson.title}
                  </h4>
                  <p>{lesson.short_description}</p>

                  {/* Expandable content */}
                  {selectedLesson === lesson.id && isAccessible && (
                    <div className={styles.lessonContent}>
                      {lesson.detailed_content ? (
                        <div
                          className={styles.detailedContent}
                          dangerouslySetInnerHTML={{
                            __html: fixImagePaths(lesson.detailed_content),
                          }}
                        />
                      ) : (
                        <p>No detailed content available.</p>
                      )}

                      {lesson.video_url && (
                        <div className={styles.videoPlayer}>
                          {lesson.video_url.includes("youtube.com") ||
                          lesson.video_url.includes("youtu.be") ? (
                            <iframe
                              width="100%"
                              height="400"
                              src={`https://www.youtube.com/embed/${new URLSearchParams(
                                new URL(lesson.video_url).search
                              ).get("v")}`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title="YouTube Video"
                            ></iframe>
                          ) : (
                            <video controls>
                              <source src={lesson.video_url} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          )}
                        </div>
                      )}

                      {lesson.exercise_type &&
                        renderExercise(
                          lesson.exercise_type,
                          lesson.exercise_data,
                          lesson.id
                        )}

                      {!isCompleted && (
                        <button
                          className={`${styles.completeLessonBtn} button button--primary`}
                          onClick={() => handleCompleteLesson(lesson.id)}
                          disabled={!isAccessible}
                        >
                          Complete Lesson
                        </button>
                      )}
                      {isCompleted && <p>This lesson is completed.</p>}
                    </div>
                  )}
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
            <button onClick={handleCourseCompletion}>
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
        className="floating-progress-btn"
        onClick={() => setShowProgress((p) => !p)}
      >
        Progress
      </button>

      {showProgress && (
        <div className="progress-panel show">
          <button
            className="close-panel-btn"
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
