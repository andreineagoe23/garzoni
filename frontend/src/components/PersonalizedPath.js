import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import "../styles/scss/main.scss";
import Loader from "../components/Loader";

function PersonalizedPath({ onCourseClick }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentVerified, setPaymentVerified] = useState(false);
  const queryParams = new URLSearchParams(location.search);
  const sessionId = queryParams.get("session_id");

  // First check: Authentication & Payment Status
  useEffect(() => {
    const verifyAuthAndPayment = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate(
          `/login?returnUrl=${encodeURIComponent("/personalized-path")}`
        );
        return;
      }

      try {
        // Check authentication and payment status in one request
        const profileRes = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // If Stripe session_id is present, verify payment manually
        if (sessionId) {
          try {
            await axios.post(
              `${process.env.REACT_APP_BACKEND_URL}/verify-payment/`,
              { session_id: sessionId },
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            // After manual verification, user should be marked as paid
            setPaymentVerified(true);
            fetchPersonalizedPath();
            return;
          } catch (verifyError) {
            console.error("Payment verification error:", verifyError);
            // Continue with regular profile check
          }
        }

        if (!profileRes.data.has_paid) {
          navigate("/payment-required");
        } else {
          setPaymentVerified(true);
          fetchPersonalizedPath();
        }
      } catch (error) {
        console.error("Verification error:", error);
        localStorage.removeItem("access_token");
        navigate(`/login?returnUrl=${encodeURIComponent(location.pathname)}`);
      }
    };

    verifyAuthAndPayment();
  }, [navigate, location.pathname, sessionId]);

  // Fetch personalized path data after verification
  const fetchPersonalizedPath = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      setPersonalizedCourses(
        response.data.courses.map((course) => ({
          ...course,
          image: course.image || "/fallback-course.png",
          progress: course.completed_lessons || 0,
          totalLessons: course.total_lessons || 0,
        }))
      );
      setIsLoading(false);
    } catch (error) {
      setError("Failed to load recommendations. Please try again later.");
      setIsLoading(false);
    }
  };

  const handleCourseClick = (courseId) => {
    if (onCourseClick) onCourseClick(courseId);
  };

  if (!paymentVerified || isLoading) {
    return <Loader message="Verifying your access..." />;
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
          Your personalized learning path:
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
                  <span className={`text-muted mt-2 d-block`}>
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
