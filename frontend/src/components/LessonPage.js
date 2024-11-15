import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import styles from "../styles/LessonPage.module.css";

function LessonPage() {
  const { courseId } = useParams(); // Get courseId from URL params
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);

  // UseEffect to fetch lessons and completed lessons
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
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        console.log("Fetched lessons:", response.data); // Debug: Ensure detailed_content is present
        setLessons(response.data); // Save lessons, including detailed_content
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
        setCompletedLessons(JSON.parse(storedProgress)); // Get progress from localStorage
      } else {
        // Fetch from the backend if nothing is stored
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
            // Store in localStorage
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
      // Automatically unlock next lesson after completing the current one
      const nextLessonId = lessons.find((lesson) => lesson.id === lessonId + 1);
      if (nextLessonId) {
        setSelectedLesson(nextLessonId.id); // Automatically select next lesson
      }
    } catch (err) {
      console.error("Failed to complete lesson:", err);
      setError("Failed to complete lesson. Please try again.");
    }
  };

  const handleLessonClick = (lessonId) => {
    // Toggle the visibility of lesson content
    if (selectedLesson === lessonId) {
      setSelectedLesson(null); // Deselect if it's already selected
    } else {
      setSelectedLesson(lessonId); // Set selected lesson to the clicked one
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
        <div className={styles.lessonBox}>
          {lessons.length > 0 ? (
            lessons.map((lesson, index) => {
              const isCompleted = completedLessons.includes(lesson.id);
              const isAccessible =
                index === 0 ||
                completedLessons.includes(lessons[index - 1]?.id); // Check if lesson is unlocked

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

                  {/* Show full content when the lesson is clicked */}
                  {selectedLesson === lesson.id && (
                    <div className={styles.lessonContent}>
                      {/* Debugging: Log to ensure detailed content exists */}
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
      </div>
    </div>
  );
}

export default LessonPage;
