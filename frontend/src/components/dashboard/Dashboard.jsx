import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import toast from "react-hot-toast";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import { GlassButton, GlassCard } from "components/ui";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import {
  fetchProgressSummary,
  fetchReviewQueue,
  fetchMasterySummary,
  fetchMissions,
} from "services/userService";
import { attachToken } from "services/httpClient";
import { useAnalytics } from "hooks/useAnalytics";
import { usePreferences } from "hooks/usePreferences";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { formatPercentage, formatNumber, getLocale } from "utils/format";

function Dashboard({ activePage: initialActivePage = "all-topics" }) {
  const [activePage, setActivePage] = useState(initialActivePage);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const { preferences } = usePreferences();
  const locale = getLocale();
  const prefersReducedMotion = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const mainContentRef = useRef(null);

  const {
    getAccessToken,
    user: authUser,
    loadProfile,
    profile: authProfile,
    refreshProfile,
    reloadEntitlements,
    entitlements,
  } = useAuth();

  useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  // Track dashboard view
  useEffect(() => {
    trackEvent("dashboard_view", {
      active_page: activePage,
      timestamp: new Date().toISOString(),
    });
  }, [activePage, trackEvent]);

  // Check for post-action state (returning from exercises/lessons)
  useEffect(() => {
    const state = location.state;
    if (state?.fromAction) {
      const { xpGained = 0, skillsImproved = [] } = state;

      // Optimistically update points so "Daily Goal" reflects XP instantly
      if (xpGained > 0) {
        queryClient.setQueryData(["profile"], (current) => {
          if (!current) return current;

          // Profile payloads in this app sometimes come as { user_data: {...} } or as the user object directly.
          if (current?.user_data) {
            const currentPoints = Number(current.user_data.points || 0);
            return {
              ...current,
              user_data: {
                ...current.user_data,
                points: currentPoints + xpGained,
              },
            };
          }

          const currentPoints = Number(current.points || 0);
          return {
            ...current,
            points: currentPoints + xpGained,
          };
        });

        // Background refresh to ensure server-truth (and update other widgets)
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] });
        refreshProfile?.().catch(console.error);
      }

      if (xpGained > 0 || skillsImproved.length > 0) {
        setTimeout(() => {
          const message = [
            xpGained > 0 && `+${xpGained} XP`,
            skillsImproved.length > 0 &&
              `${skillsImproved.length} skill${
                skillsImproved.length !== 1 ? "s" : ""
              } improved`,
          ]
            .filter(Boolean)
            .join(" • ");
          toast.success(message, {
            icon: "🎉",
            duration: 4000,
          });
        }, 500);
      }
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, queryClient, refreshProfile]);

  const {
    data: profilePayload,
    isFetching: isProfileFetching,
    isInitialLoading: isProfileLoading,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => loadProfile(),
    staleTime: 0, // Always consider stale to refetch when navigating
    cacheTime: 30000, // Keep in cache for 30 seconds
    initialData: authProfile,
    keepPreviousData: true,
  });

  const { data: progressResponse, isLoading: isProgressLoading } = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000,
  });

  const {
    data: reviewQueueData,
    error: reviewError,
    refetch: refetchReview,
  } = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
    select: (response) => response?.data || { due: [], count: 0 },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 60000,
  });

  const {
    data: masteryData,
    error: masteryError,
    refetch: refetchMastery,
  } = useQuery({
    queryKey: ["mastery-summary"],
    queryFn: fetchMasterySummary,
    select: (response) => response?.data || { masteries: [] },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 120000,
  });

  const {
    data: missionsData,
    error: missionsError,
    refetch: refetchMissions,
  } = useQuery({
    queryKey: ["missions"],
    queryFn: fetchMissions,
    select: (response) =>
      response?.data || { daily_missions: [], weekly_missions: [] },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 60000,
  });

  const profile = useMemo(() => {
    if (profilePayload?.user_data) {
      return profilePayload.user_data;
    }
    if (authProfile?.user_data) {
      return authProfile.user_data;
    }
    return profilePayload || authProfile || null;
  }, [authProfile, profilePayload]);

  const hasPaidProfile = Boolean(
    profile?.has_paid ||
      profile?.user_data?.has_paid ||
      profilePayload?.has_paid ||
      profilePayload?.user_data?.has_paid
  );
  const hasPaid = hasPaidProfile || Boolean(entitlements?.entitled);

  const isQuestionnaireCompleted = Boolean(
    profile?.is_questionnaire_completed ||
      profile?.user_data?.is_questionnaire_completed ||
      profilePayload?.is_questionnaire_completed
  );

  useEffect(() => {
    setActivePage(
      location.pathname.includes("personalized-path")
        ? "personalized-path"
        : "all-topics"
    );

    // Check if we're returning from Stripe payment (has session_id in URL)
    const hashParams = window.location.hash.split("?")[1] || "";
    const hashQuery = new URLSearchParams(hashParams);
    const searchQuery = new URLSearchParams(window.location.search || "");
    const sessionId =
      searchQuery.get("session_id") || hashQuery.get("session_id");

    // If we have a session_id, invalidate profile to refetch payment status
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshProfile().catch(console.error);
      reloadEntitlements?.();
      // eslint-disable-next-line no-console
      console.info(
        "[dashboard] detected session_id in URL; refreshing profile/entitlements"
      );
    }
  }, [location.pathname, queryClient, refreshProfile, reloadEntitlements]);

  // Removed mobile view tracking

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const handlePersonalizedPathClick = () => {
    // Debug log to trace gating decisions
    // eslint-disable-next-line no-console
    console.info("[personalized-path] click", {
      hasPaidProfile,
      entitlementsEntitled: Boolean(entitlements?.entitled),
      isQuestionnaireCompleted,
      activePage,
    });

    // Paid users can go straight to personalized path even if questionnaire flag is stale
    if (hasPaid) {
      setActivePage("personalized-path");
      navigate("/personalized-path");
      return;
    }

    if (!isQuestionnaireCompleted) {
      navigate("/questionnaire");
      return;
    }

    if (!hasPaid) {
      navigate("/upgrade", { state: { from: location.pathname } });
      return;
    }

    setActivePage("personalized-path");
    navigate("/personalized-path");
  };

  const isLoading = isProfileLoading || isProgressLoading;

  // Calculate learning status summary (before early return to satisfy React hooks rules)
  const progressData = progressResponse?.data || {};
  const coursesCompleted =
    progressData.paths?.filter((p) => p.percent_complete === 100).length || 0;
  const overallProgress = progressData.overall_progress || 0;
  const reviewsDue = reviewQueueData?.count || 0;
  const activeMissions = useMemo(
    () => [
      ...(missionsData?.daily_missions || []).filter(
        (m) => m.status === "in_progress"
      ),
      ...(missionsData?.weekly_missions || []).filter(
        (m) => m.status === "in_progress"
      ),
    ],
    [missionsData]
  );

  // Get weakest skills (lowest proficiency)
  const weakestSkills = useMemo(() => {
    const masteries = masteryData?.masteries || [];
    return masteries
      .filter((m) => m.proficiency < 70)
      .sort((a, b) => a.proficiency - b.proficiency)
      .slice(0, 3);
  }, [masteryData]);

  // Calculate daily goal progress (30 XP target) - must be before early return
  const dailyGoalProgress = useMemo(() => {
    const targetXP = 30;
    const currentXP = profile?.points || 0;
    // This is simplified - in production, track daily XP separately
    return Math.min(100, ((currentXP % targetXP) / targetXP) * 100);
  }, [profile?.points]);

  // Determine CTA based on priority (memoized) - must be before early return
  const primaryCTA = useMemo(() => {
    if (reviewsDue > 0) {
      return {
        text: "Do your reviews",
        action: () => {
          trackEvent("cta_click", { reason: "reviews_due", count: reviewsDue });
          navigate("/exercises");
        },
        icon: "📚",
        priority: "high",
        reason: `${reviewsDue} review${reviewsDue !== 1 ? "s" : ""} due`,
      };
    }
    if (activeMissions.length > 0) {
      const lessonMission = activeMissions.find(
        (m) => m.goal_type === "complete_lesson"
      );
      if (lessonMission) {
        return {
          text: "Continue your lesson",
          action: () => {
            trackEvent("cta_click", {
              reason: "continue_lesson",
              mission_id: lessonMission.id,
            });
            if (lessonMission.goal_reference?.course_id) {
              navigate(`/lessons/${lessonMission.goal_reference.course_id}`);
            } else {
              navigate("/all-topics");
            }
          },
          icon: "📖",
          priority: "medium",
          reason: "Active lesson mission",
        };
      }
      return {
        text: "Start a mission",
        action: () => {
          trackEvent("cta_click", {
            reason: "start_mission",
            mission_count: activeMissions.length,
          });
          navigate("/missions");
        },
        icon: "🎯",
        priority: "medium",
        reason: `${activeMissions.length} active mission${
          activeMissions.length !== 1 ? "s" : ""
        }`,
      };
    }
    return {
      text: "Continue learning",
      action: () => {
        trackEvent("cta_click", { reason: "continue_learning" });
        navigate("/all-topics");
      },
      icon: "🚀",
      priority: "low",
      reason: "Keep momentum going",
    };
  }, [reviewsDue, activeMissions, navigate, trackEvent]);

  // Skip to content handler - must be before early return
  const handleSkipToContent = useCallback(() => {
    if (mainContentRef.current) {
      mainContentRef.current.focus();
      mainContentRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] pb-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 lg:px-6">
          <GlassCard className="relative overflow-hidden" padding="lg">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
            <div className="mt-6 flex gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-40" />
            </div>
          </GlassCard>
          <div className="flex flex-col gap-6">
            <SkeletonGroup>
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </SkeletonGroup>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    authUser?.first_name?.trim() ||
    authUser?.username?.trim() ||
    profile?.first_name?.trim() ||
    profile?.username?.trim() ||
    "";

  const navigationButtons = (
    <>
      <GlassButton
        variant={activePage === "all-topics" ? "active" : "ghost"}
        onClick={() => {
          setActivePage("all-topics");
          navigate("/all-topics");
        }}
        icon="📚"
        className="w-full sm:w-auto"
      >
        All Topics
      </GlassButton>

      <button
        type="button"
        onClick={handlePersonalizedPathClick}
        aria-disabled={isProfileLoading}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-sm sm:w-auto ${
          activePage === "personalized-path"
            ? "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:ring-[color:var(--primary,#1d5330)]/40"
            : "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-[color:var(--primary,#1d5330)]/10 hover:text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]/40"
        } ${
          isProfileFetching ? "opacity-80 cursor-progress" : "cursor-pointer"
        }`}
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <span>🎯</span>
        Personalized Path
        {!isQuestionnaireCompleted && (
          <span className="ml-1 rounded-full bg-[color:var(--error,#dc2626)]/20 px-2 py-0.5 text-xs font-semibold uppercase text-[color:var(--error,#dc2626)]">
            Complete Questionnaire
          </span>
        )}
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[color:var(--bg-color,#f8fafc)] via-[color:var(--bg-color,#f8fafc)] to-[color:var(--bg-color,#f1f5f9)] pb-10">
      {/* Skip to content link */}
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          handleSkipToContent();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[color:var(--primary,#1d5330)] focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 lg:px-6">
        <GlassCard
          padding="none"
          className="relative overflow-hidden rounded-3xl border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] backdrop-blur-lg transition-all px-6 py-8 hover:shadow-xl hover:shadow-[color:var(--shadow-color,rgba(0,0,0,0.12))] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-transparent to-transparent opacity-50 pointer-events-none" />
          <div className="relative">
            {/* Personalized Overview Section */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 text-2xl shadow-lg shadow-[color:var(--primary,#1d5330)]/30">
                👋
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  Welcome back{displayName ? `, ${displayName}` : ""}!
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                  Your personal learning coach is here to guide you.
                </p>
              </div>
            </div>

            {/* Daily Goal Meter */}
            <div className="mt-6 rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">
                    🎯
                  </span>
                  <span className="text-sm font-medium text-[color:var(--text-color,#111827)]">
                    Daily Goal
                  </span>
                </div>
                <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                  {formatPercentage(dailyGoalProgress, locale, 0)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/70 transition-[width] ${
                    prefersReducedMotion.current ? "" : "duration-500"
                  }`}
                  style={{ width: `${dailyGoalProgress}%` }}
                  role="progressbar"
                  aria-valuenow={dailyGoalProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Daily goal: ${formatPercentage(
                    dailyGoalProgress,
                    locale,
                    0
                  )} complete`}
                />
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                Complete reviews, lessons, and missions to reach your daily 30
                XP target
              </p>
            </div>

            {/* Learning Status Summary */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                  <span aria-hidden="true">📚</span>
                  <span>Courses Completed</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  {formatNumber(coursesCompleted, locale)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                  <span aria-hidden="true">📈</span>
                  <span>Overall Progress</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  {formatPercentage(overallProgress, locale, 0)}
                </p>
              </div>
              {reviewError ? (
                <ErrorState
                  title="Failed to load reviews"
                  message="We couldn't fetch your review queue."
                  onRetry={refetchReview}
                  cachedData={reviewQueueData}
                  className="sm:col-span-2 lg:col-span-1"
                />
              ) : (
                <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                    <span aria-hidden="true">🔄</span>
                    <span>Reviews Due</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
                    {formatNumber(reviewsDue, locale)}
                  </p>
                </div>
              )}
              {missionsError ? (
                <ErrorState
                  title="Failed to load missions"
                  message="We couldn't fetch your missions."
                  onRetry={refetchMissions}
                  className="sm:col-span-2 lg:col-span-1"
                />
              ) : (
                <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                    <span aria-hidden="true">🎯</span>
                    <span>Active Missions</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
                    {formatNumber(activeMissions.length, locale)}
                  </p>
                </div>
              )}
            </div>

            {/* Dynamic CTA Banner */}
            <div
              className={`mt-6 rounded-xl border p-4 transition-all ${
                primaryCTA.priority === "high"
                  ? "border-[color:var(--error,#dc2626)]/40 bg-gradient-to-r from-[color:var(--error,#dc2626)]/10 to-[color:var(--error,#dc2626)]/5"
                  : primaryCTA.priority === "medium"
                  ? "border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5"
                  : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {primaryCTA.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-[color:var(--text-color,#111827)]">
                      {primaryCTA.text}
                    </p>
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      {primaryCTA.reason || "Keep your learning momentum going"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={primaryCTA.action}
                  className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                  aria-label={primaryCTA.text}
                >
                  Get Started
                </button>
              </div>
            </div>

            {/* Weak-Skill Spotlight Widget */}
            {preferences.showWeakSkills && (
              <div className="mt-6">
                {masteryError ? (
                  <ErrorState
                    title="Failed to load skills"
                    message="We couldn't fetch your skill mastery data."
                    onRetry={refetchMastery}
                  />
                ) : weakestSkills.length > 0 ? (
                  <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl" aria-hidden="true">
                        🎯
                      </span>
                      <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                        Weakest Skills
                      </h3>
                    </div>
                    <p className="text-sm text-[color:var(--muted-text,#6b7280)] mb-4">
                      Focus on these areas to strengthen your learning
                      foundation.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {weakestSkills.map((skill) => (
                        <div
                          key={skill.skill}
                          className="group rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-3 text-left transition hover:border-[color:var(--error,#dc2626)]/40 hover:shadow-md"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              trackEvent("weak_skill_click", {
                                skill: skill.skill,
                                proficiency: skill.proficiency,
                              });
                              navigate("/exercises");
                            }}
                            className="w-full text-left focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40 rounded"
                            aria-label={`Practice ${skill.skill} skill`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                                {skill.skill}
                              </span>
                              <span className="text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                                {formatPercentage(skill.proficiency, locale, 0)}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r from-[color:var(--error,#dc2626)] to-[color:var(--error,#dc2626)]/70 transition-all ${
                                  prefersReducedMotion.current
                                    ? ""
                                    : "duration-300"
                                }`}
                                style={{ width: `${skill.proficiency}%` }}
                                role="progressbar"
                                aria-valuenow={skill.proficiency}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)] group-hover:text-[color:var(--error,#dc2626)] transition">
                              Low mastery in {skill.skill} →
                            </p>
                          </button>
                          <div className="mt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                trackEvent("improve_recommendation_click", {
                                  skill: skill.skill,
                                });
                                navigate("/exercises", {
                                  state: {
                                    from: "dashboard",
                                    targetSkill: skill.skill,
                                    reason: "improve_weak_skill",
                                  },
                                });
                              }}
                              className="text-[10px] text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--primary,#1d5330)] underline bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 rounded"
                              aria-label={`Practice ${skill.skill} to improve this recommendation`}
                            >
                              Practice
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon="🎯"
                    title="No weak skills found"
                    description="Great job! You're maintaining strong proficiency across all skills. Keep practicing to stay sharp."
                  />
                )}
              </div>
            )}
          </div>
        </GlassCard>

        <div id="main-content" ref={mainContentRef} tabIndex={-1} role="main">
          {activePage === "all-topics" ? (
            <AllTopics
              onCourseClick={handleCourseClick}
              navigationControls={navigationButtons}
            />
          ) : (
            <div className="space-y-6">
              <GlassCard
                padding="md"
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:ml-auto">
                  {navigationButtons}
                </div>
              </GlassCard>
              <PersonalizedPath onCourseClick={handleCourseClick} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
