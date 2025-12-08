import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  const {
    getAccessToken,
    user: authUser,
    loadProfile,
    profile: authProfile,
  } = useAuth();

  useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  const {
    data: profilePayload,
    isLoading: isProfileLoading,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => loadProfile(),
  });

  const {
    data: progressResponse,
    isLoading: isProgressLoading,
  } = useQuery({
    queryKey: ["progress-summary"],
    queryFn: fetchProgressSummary,
  });

  useEffect(() => {
    if (profilePayload) {
      setIsQuestionnaireCompleted(
        Boolean(profilePayload.is_questionnaire_completed)
      );
    }
  }, [profilePayload]);

  useEffect(() => {
    setActivePage(
      location.pathname.includes("personalized-path")
        ? "personalized-path"
        : "all-topics"
    );
  }, [location.pathname]);

  // Removed mobile view tracking

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const profile = useMemo(() => {
    if (authProfile?.user_data) {
      return authProfile.user_data;
    }
    return authProfile || null;
  }, [authProfile]);

  const isLoading = isProfileLoading || isProgressLoading;

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
                  Explore your learning paths and track progress in one
                  place.
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

              <GlassButton
                variant={
                  activePage === "personalized-path" ? "active" : "ghost"
                }
                onClick={() => {
                  setActivePage("personalized-path");
                  navigate("/personalized-path");
                }}
                disabled={!isQuestionnaireCompleted}
                icon="🎯"
              >
                Personalized Path
                {!isQuestionnaireCompleted && (
                  <span className="ml-1 rounded-full bg-[color:var(--error,#dc2626)]/20 px-2 py-0.5 text-xs font-semibold uppercase text-[color:var(--error,#dc2626)]">
                    Complete Questionnaire
                  </span>
                )}
              </GlassButton>
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
