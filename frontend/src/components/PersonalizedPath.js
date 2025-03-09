import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "../styles/PersonalizedPath.css";

function PersonalizedPath({ onCourseClick }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [recommendationMessage, setRecommendationMessage] = useState(
    "Here are some courses we recommend for you based on your preferences:"
  );

  const handleCourseClick = (courseId) => {
    onCourseClick(courseId);
  };
  useEffect(() => {
    const fetchPersonalizedPath = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("[DEBUG] Starting personalized path fetch");
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
          {
            withCredentials: true,
            timeout: 10000,
          }
        );

        console.log("[DEBUG] API Response:", response.data);

        if (!response.data?.courses?.length) {
          console.warn("[WARN] No courses in response");
          setError("No recommendations found matching your profile");
          return;
        }

        setPersonalizedCourses(
          response.data.courses.map((course) => ({
            ...course,
            image: course.image || "/fallback-course.png",
            progress: course.completed_lessons || 0,
            totalLessons: course.total_lessons || 0,
          }))
        );

        setRecommendationMessage(
          response.data.message || "Your personalized learning path:"
        );
      } catch (error) {
        console.error("[ERROR] Fetch failed:", error);

        // Handle specific error cases
        if (error.response) {
          // Server responded with error status
          console.error("[ERROR] Server response:", error.response.data);

          if (error.response.status === 400) {
            navigate("/questionnaire");
            return;
          }

          if (error.response.status === 503) {
            setError(
              "Service temporarily unavailable. Please try again in a few minutes."
            );
            return;
          }
        }

        // Generic error message
        setError(
          "We're having trouble loading recommendations. Please try again later."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonalizedPath();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your personalized learning path...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>⚠️ Error Loading Recommendations</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }
  return (
    <div className="personalized-path">
      <div className="path-header">
        <p className="recommendation-message">{recommendationMessage}</p>
      </div>

      <div className="path-container">
        {personalizedCourses.map((course, index) => (
          <React.Fragment key={course.id}>
            <div className={`path-item ${index % 2 === 0 ? "left" : "right"}`}>
              <div className="course-node">
                <div className="course-circle">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="course-image"
                    onError={(e) => {
                      e.target.src = "/default-course.jpg";
                    }}
                  />
                </div>
                <div className="horizontal-connector"></div>
              </div>

              <motion.div
                className="course-box"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCourseClick(course.id)}
              >
                <div className="course-tags">
                  <span
                    className={`tag ${course.path_title
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {course.path_title}
                  </span>
                  <span className="difficulty">
                    Level: {course.difficulty || "Beginner"}
                  </span>
                </div>

                <h4>{course.title}</h4>

                <div className="course-meta">
                  <div className="progress-container">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${
                          (course.progress / course.totalLessons) * 100
                        }%`,
                      }}
                    ></div>
                    <span>
                      {course.progress}/{course.totalLessons} lessons
                    </span>
                  </div>

                  <div className="course-stats">
                    <div className="stat">
                      <span>⏱️</span>
                      {course.estimated_duration || 4} hrs
                    </div>
                    <div className="stat">
                      <span>💪</span>
                      {course.exercises || 3} exercises
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {index < personalizedCourses.length - 1 && (
              <div className="vertical-connector"></div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="path-footer">
        <p>
          🔁 Based on your latest questionnaire responses -
          <button
            onClick={() => navigate("/questionnaire")}
            className="update-prefs"
          >
            Update Preferences
          </button>
        </p>
      </div>
    </div>
  );
}

export default PersonalizedPath;
