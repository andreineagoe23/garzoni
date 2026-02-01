import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  startTransition,
} from "react";
import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import toast from "react-hot-toast";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import { GlassButton, GlassCard } from "components/ui";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import {
  fetchReviewQueue,
  fetchMasterySummary,
  fetchMissions,
} from "services/userService";
import { UserProfile } from "types/api";
import { attachToken } from "services/httpClient";
import { useAnalytics } from "hooks/useAnalytics";
import { usePreferences } from "hooks/usePreferences";
import DashboardHeader from "./DashboardHeader";
import DailyGoalCard from "./DailyGoalCard";
import StatusSummary from "./StatusSummary";
import EntitlementUsage from "./EntitlementUsage";
import PrimaryCTA from "./PrimaryCTA";
import WeakSkills from "./WeakSkills";
import QuestionnaireReminderBanner from "components/onboarding/QuestionnaireReminderBanner";
import { selectPrimaryCTA } from "./primaryCtaSelector";
import { getLocale } from "utils/format";
import { useProgressSummaryQuery } from "hooks/useProgressSummaryQuery";
import { useDashboardSummary } from "hooks/useDashboardSummary";
import { queryKeys, staleTimes } from "lib/reactQuery";

type WeakSkill = {
  skill: string;
  proficiency: number;
};

type PrimaryCtaData = {
  text: string;
  action: () => void;
  icon?: string;
  priority?: "high" | "medium" | "low";
  reason?: string;
};

function Dashboard({ activePage: initialActivePage = "all-topics" }) {
  const [activePage, setActivePage] = useState(initialActivePage);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const { preferences } = usePreferences();
  const { adminMode, toggleAdminMode, canAdminister } = useAdmin();
  const locale = getLocale();
  const prefersReducedMotion = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  const {
    getAccessToken,
    user: authUser,
    loadProfile,
    profile: authProfile,
    reloadEntitlements,
    entitlements,
    isInitialized: authInitialized,
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
        queryClient.setQueryData<UserProfile | null>(
          queryKeys.profile(),
          (current) => {
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
          }
        );

        // Background refresh to ensure server-truth (and update other widgets)
        queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
        queryClient.invalidateQueries({
          queryKey: queryKeys.progressSummary(),
        });
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
  }, [location.state, queryClient]);

  const {
    data: profilePayload,
    isFetching: isProfileFetching,
    isInitialLoading: isProfileLoading,
  } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => loadProfile(),
    staleTime: staleTimes.profile,
    gcTime: 30_000,
    initialData: authProfile,
    placeholderData: (previousData) => previousData ?? authProfile,
  });

  const { data: progressResponse, isLoading: isProgressLoading } =
    useProgressSummaryQuery({
      // Dashboard should feel responsive, but doesn't need constant refetching.
      // Invalidation is triggered after lesson/exercise completion elsewhere.
      retry: 2,
    });

  const {
    data: reviewQueueData,
    error: reviewError,
    refetch: refetchReview,
  } = useQuery({
    queryKey: queryKeys.reviewQueue(),
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
    queryKey: queryKeys.masterySummary(),
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
    queryKey: queryKeys.missions(),
    queryFn: fetchMissions,
    select: (response) =>
      response?.data || { daily_missions: [], weekly_missions: [] },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 60000,
    refetchInterval: 120000,
    refetchIntervalInBackground: true,
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
    (profile as UserProfile)?.has_paid ||
    (profile as UserProfile)?.user_data?.has_paid ||
    (profilePayload as UserProfile)?.has_paid ||
    (profilePayload as UserProfile)?.user_data?.has_paid
  );
  const hasPaid = hasPaidProfile || Boolean(entitlements?.entitled);

  const isQuestionnaireCompleted = Boolean(
    (profile as UserProfile)?.is_questionnaire_completed ||
    (profile as UserProfile)?.user_data?.is_questionnaire_completed ||
    (profilePayload as UserProfile)?.is_questionnaire_completed
  );

  useEffect(() => {
    setActivePage(
      location.pathname.includes("personalized-path")
        ? "personalized-path"
        : "all-topics"
    );

    // Check if we're returning from Stripe payment (has session_id in URL)
    const searchQuery = new URLSearchParams(location.search || "");
    const sessionId = searchQuery.get("session_id");

    // If we have a session_id, invalidate profile to refetch payment status
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      reloadEntitlements?.();
    }
  }, [location.pathname, location.search, queryClient, reloadEntitlements]);

  // Refetch questionnaire progress and profile when dashboard mounts so we have fresh onboarding status
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["questionnaire-progress"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  }, [queryClient]);

  // Redirect new users (incomplete onboarding) to onboarding when they land on dashboard
  // Only redirect once we have loaded profile (not loading) and it says not completed
  useEffect(() => {
    if (!authInitialized || isProfileLoading) return;
    if (hasPaid) return;
    if (isQuestionnaireCompleted) return;
    // No profile yet (e.g. first load): don't redirect until we have data
    if (profilePayload === undefined && !authProfile) return;
    navigate("/onboarding", { replace: true });
  }, [authInitialized, isProfileLoading, hasPaid, isQuestionnaireCompleted, profilePayload, authProfile, navigate]);

  // Removed mobile view tracking

  const handleCourseClick = (courseId: number, pathId?: number) => {
    if (pathId) {
      navigate(`/courses/${pathId}/lessons/${courseId}/flow`);
      return;
    }
    navigate(`/lessons/${courseId}/flow`);
  };

  const handlePersonalizedPathClick = () => {
    // Paid users can go straight to personalized path even if questionnaire flag is stale
    if (hasPaid) {
      startTransition(() => setActivePage("personalized-path"));
      navigate("/personalized-path");
      return;
    }

    if (!isQuestionnaireCompleted) {
      navigate("/onboarding");
      return;
    }

    if (!hasPaid) {
      navigate("/subscriptions", { state: { from: location.pathname } });
      return;
    }

    startTransition(() => setActivePage("personalized-path"));
    navigate("/personalized-path");
  };

  const isLoading = isProfileLoading || isProgressLoading;

  // Calculate learning status summary (before early return to satisfy React hooks rules)
  const {
    coursesCompleted,
    overallProgress,
    reviewsDue,
    activeMissions,
    entitlementUsage,
    weakestSkills,
    dailyGoalProgress,
  } = useDashboardSummary({
    progressResponse,
    reviewQueueData,
    missionsData,
    masteryData,
    entitlements,
    profile: profile ?? undefined,
  });

  const weakSkillItems = useMemo(
    () =>
      weakestSkills
        .filter((skill): skill is WeakSkill =>
          Boolean((skill as WeakSkill).skill)
        )
        .map((skill) => ({
          skill: skill.skill,
          proficiency: skill.proficiency ?? 0,
        })),
    [weakestSkills]
  );

  // Determine CTA based on priority (memoized) - must be before early return
  const primaryCTASignal = useMemo(
    () => selectPrimaryCTA({ reviewsDue, activeMissions }),
    [reviewsDue, activeMissions]
  );

  const primaryCTA = useMemo<PrimaryCtaData | null>(() => {
    if (!primaryCTASignal) return null;

    switch (primaryCTASignal.type) {
      case "reviews_due":
        return {
          text: "Do Reviews",
          action: () => {
            trackEvent("cta_click", {
              reason: "reviews_due",
              count: reviewsDue,
            });
            navigate("/exercises");
          },
          icon: primaryCTASignal.icon,
          priority: "high",
          reason: `${primaryCTASignal.reasonCount || 0} review${(primaryCTASignal.reasonCount || 0) > 1 ? 's' : ''} due`,
        };
      case "continue_lesson": {
        const lessonMission = primaryCTASignal.mission;
        return {
          text: "Continue Lesson",
          action: () => {
            trackEvent("cta_click", {
              reason: "continue_lesson",
              mission_id: lessonMission?.id,
            });
            if (lessonMission?.goal_reference?.course_id) {
              navigate(
                `/lessons/${lessonMission.goal_reference.course_id}/flow`
              );
            } else {
              navigate("/all-topics");
            }
          },
          icon: primaryCTASignal.icon,
          priority: "medium",
          reason: "Continue where you left off",
        };
      }
      case "start_mission":
        return {
          text: "Start Mission",
          action: () => {
            trackEvent("cta_click", {
              reason: "start_mission",
              mission_count: activeMissions.length,
            });
            navigate("/missions");
          },
          icon: primaryCTASignal.icon,
          priority: "medium",
          reason: `${primaryCTASignal.reasonCount || 0} mission${(primaryCTASignal.reasonCount || 0) > 1 ? 's' : ''} available`,
        };
      default:
        return {
          text: "Continue Learning",
          action: () => {
            trackEvent("cta_click", { reason: "continue_learning" });
            navigate("/all-topics");
          },
          icon: primaryCTASignal.icon,
          priority: "low",
          reason: "Continue your learning journey",
        };
    }
  }, [
    primaryCTASignal,
    reviewsDue,
    activeMissions.length,
    navigate,
    trackEvent,
  ]);

  // Skip to content handler - must be before early return
  const handleSkipToContent = useCallback(() => {
    if (mainContentRef.current) {
      mainContentRef.current.focus();
      mainContentRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleWeakSkillClick = useCallback(
    (skill: WeakSkill) => {
      trackEvent("weak_skill_click", {
        skill: skill.skill,
        proficiency: skill.proficiency,
      });
      navigate("/exercises");
    },
    [navigate, trackEvent]
  );

  const handleWeakSkillPractice = useCallback(
    (skill: WeakSkill) => {
      trackEvent("improve_recommendation_click", { skill: skill.skill });
      navigate("/exercises", {
        state: {
          from: "dashboard",
          targetSkill: skill.skill,
          reason: "improve_weak_skill",
        },
      });
    },
    [navigate, trackEvent]
  );

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
    (profile as UserProfile)?.first_name?.trim() ||
    (profile as UserProfile)?.username?.trim() ||
    "";

  const navigationButtons = (
    <>
      <GlassButton
        variant={activePage === "all-topics" ? "active" : "ghost"}
        onClick={() => {
          startTransition(() => {
            setActivePage("all-topics");
            navigate("/all-topics");
          });
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
            Complete Onboarding
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
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 lg:px-6">
        <GlassCard
          padding="none"
          className="relative overflow-hidden rounded-3xl border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] backdrop-blur-lg transition-all px-6 py-8 hover:shadow-xl hover:shadow-[color:var(--shadow-color,rgba(0,0,0,0.12))] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-transparent to-transparent opacity-50 pointer-events-none" />
          <div className="relative">
            <DashboardHeader
              displayName={displayName}
              canAdminister={canAdminister}
              adminMode={adminMode}
              toggleAdminMode={toggleAdminMode}
            />

            <QuestionnaireReminderBanner
              hasPaid={hasPaid}
              authReady={authInitialized}
            />

            <DailyGoalCard
              dailyGoalProgress={dailyGoalProgress}
              locale={locale}
              prefersReducedMotion={prefersReducedMotion.current}
            />

            <StatusSummary
              coursesCompleted={coursesCompleted}
              overallProgress={overallProgress}
              reviewsDue={reviewsDue}
              activeMissionsCount={activeMissions.length}
              reviewError={reviewError}
              missionsError={missionsError}
              refetchReview={refetchReview}
              refetchMissions={refetchMissions}
              reviewQueueData={reviewQueueData}
              locale={locale}
            />

            <EntitlementUsage entitlementUsage={entitlementUsage} />

            <PrimaryCTA primaryCTA={primaryCTA} />

            <WeakSkills
              show={preferences.showWeakSkills}
              masteryError={masteryError}
              weakestSkills={weakSkillItems}
              refetchMastery={refetchMastery}
              locale={locale}
              prefersReducedMotion={prefersReducedMotion.current}
              onSkillClick={handleWeakSkillClick}
              onPracticeClick={handleWeakSkillPractice}
            />
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

Dashboard.propTypes = {
  activePage: PropTypes.string,
};

export default Dashboard;
