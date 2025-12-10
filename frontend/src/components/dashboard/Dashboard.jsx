import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import UserProgressBox from "components/widgets/UserProgressBox";
import { GlassButton, GlassCard } from "components/ui";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { fetchProgressSummary } from "services/userService";
import { attachToken } from "services/httpClient";
import PremiumUpsellPanel from "components/billing/PremiumUpsellPanel";

function Dashboard({ activePage: initialActivePage = "all-topics" }) {
  const [activePage, setActivePage] = useState(initialActivePage);
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    getAccessToken,
    user: authUser,
    loadProfile,
    profile: authProfile,
    refreshProfile,
  } = useAuth();

  useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  const { data: profilePayload, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => loadProfile(),
    staleTime: 0, // Always consider stale to refetch when navigating
    cacheTime: 30000, // Keep in cache for 30 seconds
  });

  const { data: progressResponse, isLoading: isProgressLoading } = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
  });

  const profile = useMemo(() => {
    if (authProfile?.user_data) {
      return authProfile.user_data;
    }
    return authProfile || null;
  }, [authProfile]);

  const hasPaid =
    Boolean(profilePayload?.has_paid) ||
    Boolean(profilePayload?.user_data?.has_paid) ||
    Boolean(profile?.has_paid) ||
    Boolean(profile?.user_data?.has_paid);

  useEffect(() => {
    if (profilePayload) {
      setIsQuestionnaireCompleted(
        Boolean(
          profilePayload.is_questionnaire_completed ??
            profilePayload.user_data?.is_questionnaire_completed
        )
      );
    }
  }, [profilePayload]);

  useEffect(() => {
    setActivePage(
      location.pathname.includes("personalized-path")
        ? "personalized-path"
        : "all-topics"
    );

    // Check if we're returning from Stripe payment (has session_id in URL)
    const hashParams = window.location.hash.split("?")[1] || "";
    const queryParams = new URLSearchParams(hashParams);
    const sessionId = queryParams.get("session_id");

    // If we have a session_id, invalidate profile to refetch payment status
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshProfile().catch(console.error);
    }
  }, [location.pathname, queryClient, refreshProfile]);

  // Removed mobile view tracking

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const handlePersonalizedPathClick = () => {
    // Simple redirect logic: if paid, go to personalized path, otherwise go to questionnaire
    if (hasPaid) {
      setActivePage("personalized-path");
      navigate("/personalized-path");
    } else {
      navigate("/questionnaire");
    }
  };

  const isLoading = isProfileLoading || isProgressLoading;

  const usage =
    progressResponse?.data?.usage || progressResponse?.usage || undefined;

  const quotaChips = [
    {
      label: "Free lessons today",
      used: usage?.free_lessons?.used ?? 2,
      total: usage?.free_lessons?.total ?? 5,
      helper: "Short sessions keep momentum strong.",
      icon: "📖",
    },
    {
      label: "Practice quizzes",
      used: usage?.practice_quizzes?.used ?? 1,
      total: usage?.practice_quizzes?.total ?? 3,
      helper: "Quiz yourself to lock in learning.",
      icon: "🧠",
    },
    {
      label: "AI coach replies",
      used: usage?.ai_responses?.used ?? 8,
      total: usage?.ai_responses?.total ?? 10,
      helper: "Chat with Monevo for instant clarity.",
      icon: "🤖",
    },
  ];

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
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-10 lg:items-stretch">
            <main className="flex flex-1 flex-col space-y-6 min-h-0">
              <SkeletonGroup>
                <Skeleton className="h-40 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </SkeletonGroup>
            </main>
            <aside className="flex w-full max-w-[320px] shrink-0 min-h-0">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </aside>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[color:var(--bg-color,#f8fafc)] via-[color:var(--bg-color,#f8fafc)] to-[color:var(--bg-color,#f1f5f9)] pb-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 lg:px-6">
        <GlassCard className="relative overflow-hidden" padding="lg">
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-transparent to-transparent opacity-50 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 text-2xl shadow-lg shadow-[color:var(--primary,#1d5330)]/30">
                👋
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
                  Welcome back{displayName ? `, ${displayName}` : ""}!
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                  Explore your learning paths and track progress in one place.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <GlassButton
                variant={activePage === "all-topics" ? "active" : "ghost"}
                onClick={() => {
                  setActivePage("all-topics");
                  navigate("/all-topics");
                }}
                icon="📚"
              >
                All Topics
              </GlassButton>

              <button
                type="button"
                onClick={handlePersonalizedPathClick}
                disabled={false}
                className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-sm ${
                  activePage === "personalized-path"
                    ? "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:ring-[color:var(--primary,#1d5330)]/40"
                    : "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-[color:var(--primary,#1d5330)]/10 hover:text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]/40"
                }`}
                style={{
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  pointerEvents: "auto",
                  cursor: "pointer",
                  opacity: "1",
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
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quotaChips.map((chip) => {
                const total = Number(chip.total) || 0;
                const used = Number(chip.used) || 0;
                const percent =
                  total > 0
                    ? Math.min(100, Math.round((used / total) * 100))
                    : 0;

                return (
                  <div
                    key={chip.label}
                    className="group relative overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--primary,#1d5330)]/40 hover:shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/5 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-color,#111827)]">
                          <span aria-hidden="true">{chip.icon}</span>
                          <span>{chip.label}</span>
                        </div>
                        <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                          {chip.helper}
                        </p>
                      </div>
                      <span className="rounded-full bg-[color:var(--primary,#1d5330)]/10 px-2 py-1 text-[11px] font-semibold text-[color:var(--primary,#1d5330)]">
                        {used}/{total || "∞"}
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/70 transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10 lg:items-stretch">
          <main className="flex flex-1 flex-col space-y-6 min-h-0">
            {activePage === "all-topics" ? (
              <AllTopics onCourseClick={handleCourseClick} />
            ) : (
              <PersonalizedPath onCourseClick={handleCourseClick} />
            )}
          </main>

          <aside className="flex w-full max-w-[320px] shrink-0 min-h-0">
            <div className="flex w-full flex-col gap-4">
              <UserProgressBox progressData={progressResponse?.data || null} />
              <PremiumUpsellPanel />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
