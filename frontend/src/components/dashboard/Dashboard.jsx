import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import UserProgressBox from "components/widgets/UserProgressBox";
import { GlassButton, GlassCard } from "components/ui";

function Dashboard({ activePage: initialActivePage = "all-topics" }) {
  const [userProgress, setUserProgress] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activePage, setActivePage] = useState(initialActivePage);
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    getAccessToken,
    user: authUser,
    loadProfile,
    profile: authProfile,
  } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const token = getAccessToken();
        const [profilePayload, progressResponse] = await Promise.all([
          loadProfile(),
          axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/userprogress/progress_summary/`,
            {
              headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : undefined,
            }
          ),
        ]);

        if (profilePayload) {
          setIsQuestionnaireCompleted(
            Boolean(profilePayload.is_questionnaire_completed)
          );
        }

        setUserProgress(progressResponse.data || null);
        setIsInitialized(true);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [getAccessToken, loadProfile]);

  useEffect(() => {
    setActivePage(
      location.pathname.includes("personalized-path")
        ? "personalized-path"
        : "all-topics"
    );
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const isMobile = windowWidth < 1024;
  const profile = useMemo(() => {
    if (authProfile?.user_data) {
      return authProfile.user_data;
    }
    return authProfile || null;
  }, [authProfile]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-color,#ffffff)]">
        <div className="flex items-center gap-3 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading dashboard...
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
        <div className="flex min-h-0 flex-col gap-6 lg:flex-row lg:gap-10 lg:items-stretch">
          <main className="flex min-h-0 flex-1 flex-col space-y-6 overflow-visible">
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

            <section className="flex min-h-0 flex-1 flex-col space-y-6">
              {activePage === "all-topics" ? (
                <AllTopics onCourseClick={handleCourseClick} />
              ) : (
                <PersonalizedPath onCourseClick={handleCourseClick} />
              )}
            </section>
          </main>

          {!isMobile && (
            <aside className="flex min-h-0 w-full max-w-[320px] shrink-0">
              <UserProgressBox progressData={userProgress} />
            </aside>
          )}
        </div>

        {isMobile && userProgress && (
          <GlassCard padding="lg">
            <h4 className="mb-4 flex items-center gap-2 text-base font-semibold text-[color:var(--text-color,#111827)]">
              <span>Learning Progress</span>
            </h4>
            <UserProgressBox progressData={userProgress} initiallyExpanded />
          </GlassCard>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
