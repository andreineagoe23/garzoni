import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "../styles/scss/main.scss";

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

        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`
            }
          }
        );

        if (!response.data?.courses?.length) {
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
        if (error.response) {
          if (error.response.status === 400) {
            navigate("/questionnaire");
            return;
          }
          if (error.response.status === 503) {
            setError(
              "Service temporarily unavailable. Please try again later."
            );
            return;
          }
        }
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
      <div className="container d-flex flex-column align-items-center justify-content-center min-vh-50">
        <div
          className="spinner-border text-primary"
          style={{ width: "3rem", height: "3rem" }}
          role="status"
        >
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-4 text-muted fs-5">
          Loading your personalized learning path...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container text-center py-5">
        <div
          className="alert alert-danger mx-auto"
          style={{ maxWidth: "600px" }}
        >
          <h2 className="h4 mb-3">⚠️ Error Loading Recommendations</h2>
          <p className="mb-4">{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="personalized-path container-lg">
      <div className="path-header text-center mb-5">
        <p className="recommendation-message display-6 mb-0">
          {recommendationMessage}
        </p>
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
                    className="course-image img-fluid"
                    onError={(e) => {
                      e.target.src = "/default-course.jpg";
                    }}
                  />
                </div>
              </div>

              <motion.div
                className="course-box"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCourseClick(course.id)}
              >
                <div className="course-tags">
                  <span className={`tag bg-primary bg-opacity-10 text-primary`}>
                    {course.path_title}
                  </span>
                </div>

                <h4 className="mb-3">{course.title}</h4>

                <div className="course-meta">
                  <div className="progress-container">
                    <div className="progress">
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{
                          width: `${
                            (course.progress / course.totalLessons) * 100
                          }%`,
                          transition: "width 0.5s ease",
                        }}
                      ></div>
                    </div>
                    <span className="text-muted mt-2 d-block">
                      {course.progress}/{course.totalLessons} lessons
                    </span>
                  </div>

                  <div className="course-stats">
                    <div className="stat">
                      <span className="me-2">⏱️</span>
                      {course.estimated_duration || 4} hrs
                    </div>
                    <div className="stat">
                      <span className="me-2">💪</span>
                      {course.exercises || 3} exercises
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {index < personalizedCourses.length - 1 && (
              <div className="vertical-connector d-none d-lg-block"></div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="path-footer text-center mt-5 py-4">
        <p className="mb-0">
          🔁 Based on your latest questionnaire responses -{" "}
          <button
            onClick={() => navigate("/questionnaire")}
            className="btn btn-link text-decoration-none p-0"
          >
            Update Preferences
          </button>
        </p>
      </div>
    </div>
  );
}

export default PersonalizedPath;
