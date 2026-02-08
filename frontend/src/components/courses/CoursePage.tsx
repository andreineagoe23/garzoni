import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import PageContainer from "components/common/PageContainer";
import CourseList from "./CourseList";
import { GlassCard } from "components/ui";
import Skeleton from "components/common/Skeleton";
import Breadcrumbs from "components/common/Breadcrumbs";
import { fetchLearningPathCourses } from "services/userService";
import { attachToken } from "services/httpClient";
import { queryKeys, staleTimes } from "lib/reactQuery";

type LearningPathCoursesResponse = {
  data: {
    id: number;
    title: string;
    description?: string;
  }[];
};

function CoursePage() {
  const { pathId } = useParams();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  const { data, isLoading, error } = useQuery<LearningPathCoursesResponse, unknown>({
    queryKey: queryKeys.learningPathCourses(Number(pathId)),
    queryFn: () => fetchLearningPathCourses(pathId ?? ""),
    staleTime: staleTimes.content,
    enabled: Boolean(pathId),
  });

  const accessDenied =
    axios.isAxiosError(error) && error.response?.status === 403;
  const requiredPlan =
    axios.isAxiosError(error) ? error.response?.data?.required_plan : null;
  const errorMessage = accessDenied
    ? `Upgrade to ${requiredPlan === "pro" ? "Pro" : "Plus"} to access this path.`
    : error instanceof Error
      ? error.message
      : "We couldn't load the courses for this path. Please try again.";

  return (
    <PageContainer maxWidth="5xl">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Courses
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Explore the curated lessons inside this learning path.
        </p>
      </header>

      <Breadcrumbs
        className="mt-2"
        items={[
          { label: "Dashboard", to: "/all-topics" },
          { label: "Courses" },
        ]}
      />

      {isLoading ? (
        <GlassCard
          padding="md"
          className="flex items-center gap-3 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)]"
        >
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </GlassCard>
      ) : error ? (
        <GlassCard
          padding="md"
          className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10"
        >
          <div className="flex flex-col gap-3">
            <div>{errorMessage}</div>
            {accessDenied && (
              <button
                type="button"
                className="w-fit rounded-full bg-[color:var(--primary,#2563eb)] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg"
                onClick={() => navigate("/subscriptions")}
              >
                Upgrade
              </button>
            )}
          </div>
        </GlassCard>
      ) : (
        <CourseList courses={data?.data || []} />
      )}
    </PageContainer>
  );
}

export default CoursePage;
