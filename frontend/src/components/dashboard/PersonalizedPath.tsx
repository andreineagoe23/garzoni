import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";
import { queryKeys } from "lib/reactQuery";
import { UserProfile } from "types/api";

type PersonalizedCourse = {
  id: number;
  title?: string;
  description?: string;
  image?: string;
  progress?: number;
  totalLessons?: number;
  completed_lessons?: number;
  total_lessons?: number;
  [key: string]: unknown;
};

function PersonalizedPath({
  onCourseClick,
}: {
  onCourseClick?: (courseId: number, pathId?: number) => void;
}) {
  const [personalizedCourses, setPersonalizedCourses] = useState<
    PersonalizedCourse[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    getAccessToken,
    isAuthenticated,
    loadProfile,
    reloadEntitlements,
    entitlements,
  } = useAuth();

  const { sessionId, redirectIntent } = useMemo(() => {
    const searchQuery = new URLSearchParams(location.search || "");

    const sessionId = searchQuery.get("session_id");
    const redirectIntent = searchQuery.get("redirect");

    return { sessionId, redirectIntent };
  }, [location.search]);

  const fetchPersonalizedPath = useCallback(async () => {
    try {
      const response = await axios.get<{ courses: PersonalizedCourse[] }>(
        `${BACKEND_URL}/personalized-path/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            "X-CSRFToken":
              document.cookie.match(/csrftoken=([\w-]+)/)?.[1] || "",
          },
          withCredentials: true,
        }
      );

      setPersonalizedCourses(
        response.data.courses.map((course: PersonalizedCourse) => ({
          ...course,
          image: course.image || "/fallback-course.png",
          progress: course.completed_lessons || 0,
          totalLessons: course.total_lessons || 0,
        }))
      );
      setIsLoading(false);
    } catch (err) {
      const status = err.response?.status;
      const errorMessage = err.response?.data?.error || "Access denied";
      const redirectPath = err.response?.data?.redirect;

      if (status === 400 || status === 403) {
        if (redirectPath) {
          navigate(redirectPath);
        } else if (
          errorMessage.toLowerCase().includes("onboarding") ||
          errorMessage.toLowerCase().includes("questionnaire")
        ) {
          navigate("/onboarding");
        } else if (errorMessage.toLowerCase().includes("payment")) {
          navigate("/subscriptions");
        } else {
          setError("Failed to load recommendations. Please try again later.");
        }
      } else {
        setError("Failed to load recommendations. Please try again later.");
      }
      setIsLoading(false);
    }
  }, [navigate, getAccessToken]);

  useEffect(() => {
    const verifyAuthAndPayment = async () => {
      if (!isAuthenticated) {
        navigate(
          `/login?returnUrl=${encodeURIComponent("/personalized-path")}`
        );
        return;
      }

      try {
        // Always force-refresh to avoid stale has_paid/questionnaire flags after checkout
        let profilePayload = await loadProfile({ force: true });
        const questionnaireCompleted = Boolean(
          (profilePayload as UserProfile)?.user_data
            ?.is_questionnaire_completed ??
          (profilePayload as UserProfile)?.is_questionnaire_completed ??
          false
        );

        if (!(profilePayload as UserProfile)?.has_paid && sessionId) {
          profilePayload = await loadProfile({ force: true });
          const pollPaymentStatus = async (attempt = 0): Promise<void> => {
            try {
              const verificationRes = await axios.post(
                `${BACKEND_URL}/verify-session/`,
                { session_id: sessionId, force_check: true },
                { headers: { Authorization: `Bearer ${getAccessToken()}` } }
              );

              if (verificationRes.data.status === "verified") {
                window.history.replaceState(
                  {},
                  document.title,
                  "/personalized-path"
                );
                queryClient.invalidateQueries({
                  queryKey: queryKeys.profile(),
                });
                await loadProfile({ force: true });
                reloadEntitlements?.();
                setPaymentVerified(true);
                return fetchPersonalizedPath();
              }

              const delay = Math.min(500 * Math.pow(2, attempt), 30000);

              if (attempt < 15) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                return pollPaymentStatus(attempt + 1);
              }

              navigate("/subscriptions");
            } catch (err) {
              if (attempt < 8) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                return pollPaymentStatus(attempt + 1);
              }
              navigate("/subscriptions");
            }
          };

          await pollPaymentStatus();
          return;
        }

        const hasPaidFlag = Boolean(
          (profilePayload as UserProfile)?.has_paid ||
          (profilePayload as UserProfile)?.user_data?.has_paid ||
          entitlements?.entitled ||
          false
        );

        if (!questionnaireCompleted) {
          navigate("/onboarding");
          return;
        }

        // If the user is paid, allow access after questionnaire completion
        if (hasPaidFlag) {
          await fetchPersonalizedPath();
          setPaymentVerified(true);
          // Clean up URL to remove session/redirect params without navigating away
          window.history.replaceState({}, document.title, "/personalized-path");
          return;
        }

        if (!hasPaidFlag) {
          navigate("/subscriptions");
          return;
        }
        await fetchPersonalizedPath();
        setPaymentVerified(true);
        if (sessionId && redirectIntent === "upgradeComplete") {
          navigate("/subscriptions?redirect=upgradeComplete");
        }
      } catch (err) {
        setError(
          err.response?.data?.error ||
            "We couldn't verify your payment. Please try again."
        );
        setPaymentVerified(false);
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
    queryClient,
    sessionId,
    redirectIntent,
    entitlements?.entitled,
    reloadEntitlements,
    location.search,
  ]);

  const handleCourseClick = (courseId: number, pathId?: number) => {
    if (onCourseClick) onCourseClick(courseId, pathId);
  };

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

  if (!paymentVerified || isLoading) {
    return (
      <GlassCard
        padding="xl"
        className="text-center text-sm text-[color:var(--muted-text,#6b7280)]"
        role="status"
        aria-live="polite"
      >
        Verifying your access...
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
                      (event.target as HTMLImageElement).src =
                        "/default-course.jpg";
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
                  onClick={() =>
                    handleCourseClick(
                      Number((course as PersonalizedCourse).id),
                      Number((course as PersonalizedCourse).path)
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleCourseClick(
                        Number((course as PersonalizedCourse).id),
                        Number((course as PersonalizedCourse).path)
                      );
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${course.title}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                        {String(
                          (course as PersonalizedCourse).path_title || "Path"
                        )}
                      </span>
                      <span className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                        {`${(course as PersonalizedCourse).estimated_duration || 4} hrs · ${(course as PersonalizedCourse).exercises || 3} exercises`}
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
                          {course.progress ?? 0}/{course.totalLessons ?? 0}{" "}
                          lessons
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width]"
                          style={{
                            width: `${
                              course.totalLessons
                                ? ((course.progress ?? 0) /
                                    (course.totalLessons ?? 1)) *
                                  100
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
          🔁 Based on your latest onboarding answers —{" "}
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
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
