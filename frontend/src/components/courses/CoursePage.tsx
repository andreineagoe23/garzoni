import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import PageContainer from "components/common/PageContainer";
import CourseList from "./CourseList";
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
  const { t } = useTranslation();
  const { pathId } = useParams();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    attachToken(getAccessToken());
  }, [getAccessToken]);

  const { data, isLoading, error } = useQuery<
    LearningPathCoursesResponse,
    unknown
  >({
    queryKey: queryKeys.learningPathCourses(Number(pathId)),
    queryFn: () => fetchLearningPathCourses(pathId ?? ""),
    staleTime: staleTimes.content,
    enabled: Boolean(pathId),
  });

  const accessDenied =
    axios.isAxiosError(error) && error.response?.status === 403;
  const requiredPlan = axios.isAxiosError(error)
    ? error.response?.data?.required_plan
    : null;
  const errorMessage = accessDenied
    ? t("courses.coursePage.upgradeToAccess", {
        plan: requiredPlan === "pro" ? "Pro" : "Plus",
      })
    : error instanceof Error
      ? error.message
      : t("courses.coursePage.loadError");

  return (
    <PageContainer maxWidth="5xl">
      <header className="app-section-glow space-y-2 pb-2 text-center md:text-left">
        <p className="app-eyebrow">{t("courses.coursePage.subtitle")}</p>
        <h1 className="app-display text-4xl text-content-primary">
          {t("courses.coursePage.title")}
        </h1>
      </header>

      <Breadcrumbs
        className="mt-2"
        items={[
          { label: t("courses.coursePage.dashboard"), to: "/all-topics" },
          { label: t("courses.coursePage.title") },
        ]}
      />

      {isLoading ? (
        <div className="app-card p-4 flex items-center gap-3 text-content-muted">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : error ? (
        <div className="app-card p-4 border-[color:var(--error,#dc2626)]/40 text-sm text-[color:var(--error,#dc2626)]">
          <div className="flex flex-col gap-3">
            <div>{errorMessage}</div>
            {accessDenied && (
              <button
                type="button"
                className="app-cta-btn !w-auto px-4 py-2 !h-auto text-xs"
                onClick={() => navigate("/subscriptions")}
              >
                {t("shared.upgrade")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <CourseList courses={data?.data || []} />
      )}
    </PageContainer>
  );
}

export default CoursePage;
