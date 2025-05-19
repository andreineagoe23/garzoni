import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import "../styles/scss/main.scss";
import Loader from "../components/Loader";
import { useAuth } from "./AuthContext";

function PersonalizedPath({ onCourseClick }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentVerified, setPaymentVerified] = useState(false);
  const { getAccessToken, isAuthenticated } = useAuth();

  // Define fetchPersonalizedPath first using useCallback
  const fetchPersonalizedPath = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            "X-CSRFToken":
              document.cookie.match(/csrftoken=([\w-]+)/)?.[1] || "",
          },
          withCredentials: true,
        }
      );

      if (response.status === 403) {
        if (response.data.redirect) {
          navigate(response.data.redirect);
          return;
        }
        throw new Error(response.data.error || "Access denied");
      }

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
      if (error.response?.status === 403) {
        const errorMessage = error.response.data?.error || "Access denied";
        if (errorMessage.includes("questionnaire")) {
          navigate("/questionnaire");
        } else if (errorMessage.includes("Payment")) {
          navigate("/payment-required");
        }
      } else {
        setError("Failed to load recommendations. Please try again later.");
      }
      setIsLoading(false);
    }
  }, [navigate, getAccessToken]);

  // Now define useEffect that uses fetchPersonalizedPath
  useEffect(() => {
    const hashParams = window.location.hash.split("?")[1] || "";
    const queryParams = new URLSearchParams(hashParams);
    const sessionId = queryParams.get("session_id");

    const verifyAuthAndPayment = async () => {
      if (!isAuthenticated) {
        navigate(
          `/#/login?returnUrl=${encodeURIComponent("/#/personalized-path")}`
        );
        return;
      }

      try {
        // Force fresh profile check
        const profileRes = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            params: { _: new Date().getTime() }, // Cache buster
          }
        );

        if (!profileRes.data.has_paid && sessionId) {
          const pollPaymentStatus = async (attempt = 0) => {
            try {
              const verificationRes = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/verify-session/`,
                { session_id: sessionId, force_check: true },
                { headers: { Authorization: `Bearer ${getAccessToken()}` } }
              );

              if (verificationRes.data.status === "verified") {
                window.history.replaceState(
                  {},
                  document.title,
                  "/#/personalized-path"
                );
                setPaymentVerified(true);
                return fetchPersonalizedPath();
              }

              const delay = Math.min(500 * Math.pow(2, attempt), 30000); // Max 30s delay

              if (attempt < 15) {
                // Increased max attempts
                await new Promise((resolve) => setTimeout(resolve, delay));
                return pollPaymentStatus(attempt + 1);
              }

              navigate("/payment-required");
            } catch (error) {
              if (attempt < 8) {
                // Increased retry attempts
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return pollPaymentStatus(attempt + 1);
              }
              navigate("/payment-required");
            }
          };

          await pollPaymentStatus();
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
  }, [
    navigate,
    location.pathname,
    location.search,
    fetchPersonalizedPath,
    isAuthenticated,
    getAccessToken,
  ]);

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
              <div className="vertical-connector d-none d-md-block"></div>
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
