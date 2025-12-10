import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

function PersonalizedPath({ onCourseClick }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { getAccessToken, isAuthenticated, loadProfile, refreshProfile } =
    useAuth();

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
    } catch (err) {
      if (err.response?.status === 403) {
        const errorMessage = err.response.data?.error || "Access denied";
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
        let profilePayload = await loadProfile();

        if (!profilePayload?.has_paid && sessionId) {
          profilePayload = await loadProfile({ force: true });
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
                // Invalidate and refetch profile to update payment status
                await refreshProfile();
                queryClient.invalidateQueries({ queryKey: ["profile"] });
                setPaymentVerified(true);
                return fetchPersonalizedPath();
              }

              const delay = Math.min(500 * Math.pow(2, attempt), 30000);

              if (attempt < 15) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                return pollPaymentStatus(attempt + 1);
              }

              navigate("/payment-required");
            } catch (err) {
              if (attempt < 8) {
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
      } catch (err) {
        console.error("Verification error:", err);
        localStorage.removeItem("access_token");
        navigate(`/login?returnUrl=${encodeURIComponent(location.pathname)}`);
      }
    };

    verifyAuthAndPayment();
  }, [
    navigate,
    location.pathname,
    fetchPersonalizedPath,
    isAuthenticated,
    getAccessToken,
    loadProfile,
    refreshProfile,
    queryClient,
  ]);

  const handleCourseClick = (courseId) => {
    if (onCourseClick) onCourseClick(courseId);
  };

  if (!paymentVerified || isLoading) {
    return (
      <GlassCard
        padding="xl"
        className="text-center text-sm text-[color:var(--muted-text,#6b7280)]"
      >
        Verifying your access...
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard
        padding="lg"
        className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-center text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10"
      >
        <h2 className="mb-3 text-lg font-semibold">
          ⚠️ Error Loading Recommendations
        </h2>
        <p className="mb-4 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
        >
          Try Again
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">
      <GlassCard padding="lg" className="text-center">
        <p className="text-lg font-semibold text-[color:var(--muted-text,#6b7280)]">
          Your personalized learning path:
        </p>
      </GlassCard>

      <div className="relative space-y-10">
        {personalizedCourses.map((course, index) => (
          <React.Fragment key={course.id}>
            <div
              className={`flex flex-col gap-6 lg:flex-row ${
                index % 2 === 0 ? "" : "lg:flex-row-reverse"
              }`}
            >
              <div className="flex items-center justify-center lg:w-1/5">
                <div className="h-24 w-24 overflow-hidden rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] shadow-lg shadow-black/10">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.target.src = "/default-course.jpg";
                    }}
                  />
                </div>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <GlassCard
                  padding="lg"
                  className="group flex-1 cursor-pointer transition"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                        {course.path_title}
                      </span>
                      <span className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                        {course.estimated_duration || 4} hrs ·{" "}
                        {course.exercises || 3} exercises
                      </span>
                    </div>
                    <h4 className="mt-3 text-xl font-semibold text-[color:var(--accent,#111827)]">
                      {course.title}
                    </h4>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[color:var(--muted-text,#6b7280)]">
                          Progress
                        </span>
                        <span className="font-semibold text-[color:var(--accent,#111827)]">
                          {course.progress}/{course.totalLessons} lessons
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width]"
                          style={{
                            width: `${
                              course.totalLessons
                                ? (course.progress / course.totalLessons) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </div>

            {index < personalizedCourses.length - 1 && (
              <div className="mx-auto hidden h-16 w-px bg-[color:var(--border-color,#d1d5db)] lg:block" />
            )}
          </React.Fragment>
        ))}
      </div>

      <GlassCard padding="md" className="text-center">
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          🔁 Based on your latest questionnaire responses —{" "}
          <button
            type="button"
            onClick={() => navigate("/questionnaire")}
            className="font-semibold text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
          >
            Update Preferences
          </button>
        </p>
      </GlassCard>
    </div>
  );
}

export default PersonalizedPath;
