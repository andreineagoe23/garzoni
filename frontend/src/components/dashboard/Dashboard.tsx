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
import { MonevoIcon } from "components/ui/monevoIcons";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import {
  fetchReviewQueue,
  fetchMasterySummary,
  fetchMissions,
} from "services/userService";
import { fetchQuestionnaireProgress } from "services/questionnaireService";
import { UserProfile } from "types/api";
import { attachToken } from "services/httpClient";
import { useAnalytics } from "hooks/useAnalytics";
import { usePreferences } from "hooks/usePreferences";
import DashboardHeader from "./DashboardHeader";
import StatusSummary from "./StatusSummary";
import PrimaryCTA from "./PrimaryCTA";
import WeakSkills from "./WeakSkills";
import QuestionnaireReminderBanner from "components/onboarding/QuestionnaireReminderBanner";
import { selectPrimaryCTA } from "./primaryCtaSelector";
import { getLocale } from "utils/format";
import { useProgressSummaryQuery } from "hooks/useProgressSummaryQuery";
import { useDashboardSummary } from "hooks/useDashboardSummary";
import { queryKeys, staleTimes } from "lib/reactQuery";
import { useTranslation } from "react-i18next";
import WeakSkillsQuickCard from "./WeakSkillsQuickCard";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
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
  const { t } = useTranslation();
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
            xpGained > 0 && t("dashboard.toast.xpGained", { count: xpGained }),
            skillsImproved.length > 0 &&
              t("dashboard.toast.skillsImproved", {
                count: skillsImproved.length,
              }),
          ]
            .filter(Boolean)
            .join(" • ");
          toast.success(message, {
            icon: <MonevoIcon name="sparkles" size={18} />,
            duration: 4000,
          });
        }, 500);
      }
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, queryClient, t]);

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

  const {
    data: questionnaireProgress,
    isLoading: isQuestionnaireProgressLoading,
    isFetching: isQuestionnaireProgressFetching,
    isFetched: isQuestionnaireProgressFetched,
  } = useQuery({
    queryKey: ["questionnaire-progress"],
    queryFn: fetchQuestionnaireProgress,
    retry: 2,
    staleTime: 0,
    refetchOnMount: true,
    enabled: authInitialized,
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
  const profilePlanId =
    (profile as UserProfile)?.subscription_plan_id ||
    (profile as UserProfile)?.user_data?.subscription_plan_id ||
    (profilePayload as UserProfile)?.subscription_plan_id ||
    (profilePayload as UserProfile)?.user_data?.subscription_plan_id ||
    null;
  const resolvedPlan: string =
    (typeof entitlements?.plan === "string" ? entitlements.plan : null) ||
    (typeof profilePlanId === "string" ? profilePlanId : null) ||
    (hasPaidProfile ? "plus" : "starter");
  const planRank = (plan?: string | null) => {
    if (plan === "plus") return 1;
    if (plan === "pro") return 2;
    return 0;
  };
  const hasPlusAccess =
    planRank(resolvedPlan) >= 1 || Boolean(entitlements?.entitled);
  const hasPaid = hasPlusAccess;

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

  // Refetch questionnaire progress, profile, and entitlements when dashboard mounts (e.g. after payment)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["questionnaire-progress"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    reloadEntitlements?.();
  }, [queryClient, reloadEntitlements]);

  // Redirect to onboarding only when questionnaire is in_progress (started but not completed).
  // Do not redirect when status is "abandoned" (user chose "Save and finish later") so they stay on dashboard.
  // Do not redirect while questionnaire progress is still loading/refetching.
  useEffect(() => {
    if (!authInitialized) return;
    if (hasPlusAccess) return;
    if (
      !isQuestionnaireProgressFetched ||
      isQuestionnaireProgressLoading ||
      isQuestionnaireProgressFetching
    )
      return;
    if (!questionnaireProgress) return;
    const progress = questionnaireProgress as { status?: string };
    if (progress.status === "completed") return;
    if (progress.status === "abandoned") return; // User chose "Save and finish later" – stay on dashboard
    navigate("/onboarding", { replace: true });
  }, [
    authInitialized,
    hasPlusAccess,
    isQuestionnaireProgressFetched,
    isQuestionnaireProgressLoading,
    isQuestionnaireProgressFetching,
    questionnaireProgress,
    navigate,
  ]);

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
    if (hasPlusAccess) {
      startTransition(() => setActivePage("personalized-path"));
      navigate("/personalized-path");
      return;
    }

    if (!isQuestionnaireCompleted) {
      navigate("/onboarding");
      return;
    }

    if (!hasPlusAccess) {
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
    weakestSkills,
    dailyGoalProgress,
    dailyGoalCurrentXP,
    dailyGoalTargetXP,
    resume,
    startHere,
    completedSections,
    totalSections,
    completedLessons,
    totalLessons,
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
          level_label: (skill as { level_label?: string }).level_label,
        })),
    [weakestSkills]
  );

  useEffect(() => {
    trackEvent("cta_click", {
      reason: "skill_insight_view",
      completed_lessons: completedLessons,
      completed_sections: completedSections,
      has_mastery: (masteryData?.masteries?.length ?? 0) > 0,
    });
    // Track first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextSkillInsightStep = useMemo(() => {
    if (reviewsDue > 0) {
      return {
        label: t("dashboard.skillInsights.nextStep.doReviews"),
        hint: t("dashboard.skillInsights.nextStepHint.reviews"),
        action: () => {
          trackEvent("cta_click", { reason: "skill_insight_reviews" });
          navigate("/exercises");
        },
      };
    }
    if (activeMissions.length > 0) {
      return {
        label: t("dashboard.skillInsights.nextStep.startMission"),
        hint: t("dashboard.skillInsights.nextStepHint.mission"),
        action: () => {
          trackEvent("cta_click", { reason: "skill_insight_mission" });
          navigate("/missions");
        },
      };
    }
    if (resume?.course_id) {
      return {
        label: t("dashboard.skillInsights.nextStep.continueLesson"),
        hint: t("dashboard.skillInsights.nextStepHint.continue"),
        action: () => {
          trackEvent("cta_click", { reason: "skill_insight_resume" });
          handleCourseClick(resume.course_id, resume.path_id ?? undefined);
        },
      };
    }
    return {
      label: t("dashboard.skillInsights.nextStep.startLearning"),
      hint: t("dashboard.skillInsights.nextStepHint.start"),
      action: () => {
        trackEvent("cta_click", { reason: "skill_insight_start" });
        if (startHere?.path_id != null && startHere?.course_id != null) {
          navigate(`/courses/${startHere.path_id}/lessons/${startHere.course_id}/flow`);
        } else {
          navigate("/all-topics");
        }
      },
    };
  }, [
    activeMissions.length,
    handleCourseClick,
    navigate,
    resume,
    reviewsDue,
    startHere?.course_id,
    startHere?.path_id,
    t,
    trackEvent,
  ]);

  // Determine CTA based on priority (memoized) - must be before early return
  const primaryCTASignal = useMemo(
    () => selectPrimaryCTA({ reviewsDue, activeMissions }),
    [reviewsDue, activeMissions]
  );

  const primaryCTA = useMemo<PrimaryCtaData | null>(() => {
    if (!primaryCTASignal) return null;

    // If the user already has a dedicated "Pick up where you left off" card,
    // don't also show a second CTA that says "Continue Lesson" – it feels like
    // a duplicate surface for the same action.
    if (primaryCTASignal.type === "continue_lesson" && resume) {
      return null;
    }

    switch (primaryCTASignal.type) {
      case "reviews_due":
        return {
          text: t("dashboard.cta.doReviews"),
          action: () => {
            trackEvent("cta_click", {
              reason: "reviews_due",
              count: reviewsDue,
            });
            navigate("/exercises");
          },
          iconName: primaryCTASignal.iconName,
          priority: "high",
          reason: t("dashboard.cta.reviewsDue", {
            count: primaryCTASignal.reasonCount || 0,
          }),
        };
      case "continue_lesson": {
        const lessonMission = primaryCTASignal.mission;
        return {
          text: t("dashboard.cta.continueLesson"),
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
          iconName: primaryCTASignal.iconName,
          priority: "medium",
          reason: t("dashboard.cta.continueWhereLeftOff"),
        };
      }
      case "start_mission":
        return {
          text: t("dashboard.cta.startMission"),
          action: () => {
            trackEvent("cta_click", {
              reason: "start_mission",
              mission_count: activeMissions.length,
            });
            navigate("/missions");
          },
          iconName: primaryCTASignal.iconName,
          priority: "medium",
          reason: t("dashboard.cta.missionsAvailable", {
            count: primaryCTASignal.reasonCount || 0,
          }),
        };
      default:
        return {
          text: t("dashboard.cta.continueLearning"),
          action: () => {
            trackEvent("cta_click", { reason: "continue_learning" });
            navigate("/all-topics");
          },
          iconName: primaryCTASignal.iconName,
          priority: "low",
          reason: t("dashboard.cta.continueLearningReason"),
        };
    }
  }, [
    primaryCTASignal,
    resume,
    reviewsDue,
    activeMissions.length,
    navigate,
    trackEvent,
    t,
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
      navigate("/exercises", {
        state: {
          from: "dashboard",
          targetSkill: skill.skill,
          reason: "weak_skill_click",
        },
      });
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
        className="w-full sm:w-auto"
      >
        {t("dashboard.nav.allTopics")}
      </GlassButton>

      <GlassButton
        variant={activePage === "personalized-path" ? "active" : "ghost"}
        onClick={handlePersonalizedPathClick}
        disabled={isProfileLoading || isProfileFetching}
        className="w-full sm:w-auto"
      >
        {t("dashboard.nav.personalizedPath")}
        {!isQuestionnaireCompleted && (
          <span className="ml-1 rounded-full bg-[color:var(--error,#dc2626)]/20 px-2 py-0.5 text-xs font-semibold uppercase text-[color:var(--error,#dc2626)]">
            {t("dashboard.nav.completeOnboarding")}
          </span>
        )}
      </GlassButton>
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
        {t("dashboard.skipToContent")}
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

            {!isQuestionnaireCompleted && (
              <QuestionnaireReminderBanner
                hasPaid={hasPaid}
                authReady={authInitialized}
              />
            )}

            {(isQuestionnaireCompleted ||
              (questionnaireProgress as { status?: string } | null)?.status ===
                "completed") ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {resume ? (
                  <div className="rounded-xl border border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5 p-4 transition-all">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl sm:text-2xl" aria-hidden="true">
                        <MonevoIcon name="bookOpen" size={28} />
                        </span>
                        <div>
                          <p className="text-sm sm:text-base font-semibold text-[color:var(--text-color,#111827)]">
                            {t("dashboard.resume.title")}
                          </p>
                          <p className="text-[11px] sm:text-xs text-[color:var(--muted-text,#6b7280)]">
                            {t("dashboard.resume.continueWith", {
                              course: resume.course_title,
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCourseClick(
                            resume.course_id,
                            resume.path_id ?? undefined
                          )
                        }
                        className="rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
                        aria-label={t("dashboard.resume.continueLesson")}
                      >
                        {t("dashboard.resume.continueLesson")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5 p-4 transition-all">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl sm:text-2xl" aria-hidden="true">
                        <MonevoIcon name="bookOpen" size={28} />
                        </span>
                        <div>
                          <p className="text-sm sm:text-base font-semibold text-[color:var(--text-color,#111827)]">
                            {t("dashboard.resume.title")}
                          </p>
                          <p className="text-[11px] sm:text-xs text-[color:var(--muted-text,#6b7280)]">
                            {t("dashboard.resume.startFirstLesson")}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            startHere?.path_id != null &&
                            startHere?.course_id != null
                          ) {
                            navigate(
                              `/courses/${startHere.path_id}/lessons/${startHere.course_id}/flow`
                            );
                          } else {
                            navigate("/all-topics");
                          }
                        }}
                        className="rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
                        aria-label={t("dashboard.resume.browseTopics")}
                      >
                        {t("dashboard.resume.browseTopics")}
                      </button>
                    </div>
                  </div>
                )}

              <WeakSkillsQuickCard
                locale={locale}
                topSkill={weakSkillItems[0] ?? null}
                onPracticeSkill={handleWeakSkillPractice}
                onExploreExercises={() => navigate("/exercises")}
              />
              </div>
            ) : (
              <WeakSkillsQuickCard
                locale={locale}
                topSkill={weakSkillItems[0] ?? null}
                onPracticeSkill={handleWeakSkillPractice}
                onExploreExercises={() => navigate("/exercises")}
              />
            )}

            <WeakSkills
              show={preferences.showWeakSkills}
              masteryError={masteryError}
              weakestSkills={weakSkillItems}
              hasAnyMasteryData={(masteryData?.masteries?.length ?? 0) > 0}
              refetchMastery={refetchMastery}
              locale={locale}
              prefersReducedMotion={prefersReducedMotion.current}
              completedSections={completedSections}
              totalSections={totalSections}
              completedLessons={completedLessons}
              totalLessons={totalLessons}
              onSkillClick={handleWeakSkillClick}
              onPracticeClick={handleWeakSkillPractice}
            />

            <StatusSummary
              coursesCompleted={coursesCompleted}
              overallProgress={overallProgress}
              reviewsDue={reviewsDue}
              activeMissionsCount={activeMissions.length}
              dailyGoalProgress={dailyGoalProgress}
              dailyGoalTargetXP={dailyGoalTargetXP}
              streakCount={(profile as UserProfile)?.streak ?? 0}
              reviewError={reviewError}
              missionsError={missionsError}
              refetchReview={refetchReview}
              refetchMissions={refetchMissions}
              reviewQueueData={reviewQueueData}
              locale={locale}
            />

            <PrimaryCTA primaryCTA={primaryCTA} />
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
                <div
                  className="hidden min-h-[1px] sm:block sm:flex-1"
                  aria-hidden
                />
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
                  {navigationButtons}
                </div>
                <div className="hidden sm:block sm:flex-1" aria-hidden />
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
