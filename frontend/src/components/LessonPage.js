import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Import useNavigate
import axios from "axios";
import styles from "../styles/LessonPage.module.css";

function LessonPage() {
  const { courseId } = useParams();
  const navigate = useNavigate(); // To navigate to another page
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [courseCompleted, setCourseCompleted] = useState(false); // Track if the course is completed

  useEffect(() => {
    const fetchLessons = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("You are not logged in. Please log in to view lessons.");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `http://localhost:8000/api/lessons/with_progress/?course=${courseId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
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

    const fetchProgress = async () => {
      const storedProgress = localStorage.getItem(
        `completedLessons_${courseId}`
      );
      if (storedProgress) {
        setCompletedLessons(JSON.parse(storedProgress));
      } else {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
          try {
            const response = await axios.get(
              "http://localhost:8000/api/userprogress/",
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            const completedLessons = response.data
              .filter((progress) => progress.is_course_complete)
              .map((progress) => progress.completed_lessons);
            setCompletedLessons(completedLessons);
            localStorage.setItem(
              `completedLessons_${courseId}`,
              JSON.stringify(completedLessons)
            );
          } catch (err) {
            console.error("Failed to fetch progress:", err);
          }
        }
      }
    };

    fetchLessons();
    fetchProgress();
  }, [courseId]);

  useEffect(() => {
    // Check if all lessons are completed
    if (lessons.length > 0 && completedLessons.length === lessons.length) {
      setCourseCompleted(true);
      console.log("Lessons fetched:", lessons);
      console.log("Completed lessons:", completedLessons);
    }
  }, [lessons, completedLessons]);

  const handleCompleteLesson = async (lessonId) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setError("You are not logged in. Please log in to complete the lesson.");
      return;
    }

    try {
      await axios.post(
        `http://localhost:8000/api/progress/complete/`,
        { lesson_id: lessonId },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      setCompletedLessons((prev) => {
        const newCompletedLessons = [...prev, lessonId];
        localStorage.setItem(
          `completedLessons_${courseId}`,
          JSON.stringify(newCompletedLessons)
        );
        return newCompletedLessons;
      });

      setSuccessMessage("Lesson completed! The next lesson is now unlocked.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Failed to complete lesson:", err);
      setError("Failed to complete lesson. Please try again.");
    }
  };

  const handleCourseCompletion = () => {
    navigate(`/quiz/${courseId}`); // Navigate to the quiz page for the course
  };

  const handleLessonClick = (lessonId) => {
    if (selectedLesson === lessonId) {
      setSelectedLesson(null);
    } else {
      setSelectedLesson(lessonId);
    }
  };

  if (loading) {
    return <p>Loading lessons...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div>
      <div className="lessons-container">
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

                  {selectedLesson === lesson.id && (
                    <div className={styles.lessonContent}>
                      {lesson.detailed_content ? (
                        <p>{lesson.detailed_content}</p>
                      ) : (
                        <p>No detailed content available.</p>
                      )}
                      {!isCompleted && (
                        <button onClick={() => handleCompleteLesson(lesson.id)}>
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

        {/* Show course completion section */}
        {courseCompleted && (
          <div className={styles.courseCompletion}>
            <h3>Congratulations! You've completed the course.</h3>
            <button onClick={handleCourseCompletion}>
              Take the Course Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LessonPage;
