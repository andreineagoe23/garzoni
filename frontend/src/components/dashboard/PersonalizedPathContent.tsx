import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { MonevoIcon } from "components/ui/monevoIcons";
import apiClient from "services/httpClient";
import { queryKeys, staleTimes } from "lib/reactQuery";
import {
  PersonalizedPathCourse,
  PersonalizedPathResponse,
  ProgressSummary,
  UserProfile,
} from "types/api";

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg className="h-10 w-10" viewBox="0 0 40 40" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r={r}
        stroke="currentColor"
        className="text-gray-300"
        strokeWidth="4"
        fill="none"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        stroke="currentColor"
        className="text-[color:var(--primary,#1d5330)]"
        strokeWidth="4"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

function courseIcon(pathTitle?: string) {
  const title = String(pathTitle || "").toLowerCase();
  if (title.includes("budget") || title.includes("saving")) return "target";
  if (
    title.includes("invest") ||
    title.includes("stock") ||
    title.includes("crypto")
  )
    return "chartLine";
  if (title.includes("debt") || title.includes("credit")) return "bolt";
  if (title.includes("mindset")) return "lightbulb";
  return "bookOpen";
}

function PersonalizedPathContent({
  onCourseClick,
}: {
  onCourseClick?: (courseId: number, pathId?: number) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, loadProfile } = useAuth();

  const { data: profilePayload, isLoading: profileLoading } =
    useQuery<UserProfile>({
      queryKey: queryKeys.profile(),
      queryFn: async () => (await loadProfile({ force: true })) as UserProfile,
      enabled: isAuthenticated,
      staleTime: staleTimes.profile,
    });

  const questionnaireCompleted = Boolean(
    profilePayload?.is_questionnaire_completed ??
    (
      profilePayload?.user_data as
        | { is_questionnaire_completed?: boolean }
        | undefined
    )?.is_questionnaire_completed ??
    false
  );

  const personalizedQuery = useQuery<PersonalizedPathResponse>({
    queryKey: ["personalizedPath"],
    queryFn: async () =>
      (await apiClient.get<PersonalizedPathResponse>("/personalized-path/"))
        .data,
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const progressSummaryQuery = useQuery<ProgressSummary>({
    queryKey: queryKeys.progressSummary(),
    queryFn: async () =>
      (await apiClient.get<ProgressSummary>("/userprogress/progress_summary/"))
        .data,
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: staleTimes.progressSummary,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/personalized-path/refresh/");
    },
    onSuccess: async () => {
      toast.success(t("personalizedPath.refreshed"));
      await personalizedQuery.refetch();
    },
    onError: () => {
      toast.error(t("personalizedPath.errors.recommendationsFailed"));
    },
  });

  const progressByCourse = useMemo(() => {
    const entries = progressSummaryQuery.data?.paths || [];
    const map = new Map<
      number,
      {
        percent: number;
        completedSections: number;
        totalSections: number;
        completedLessons: number;
        totalLessons: number;
      }
    >();
    entries.forEach((entry) => {
      if (entry.course_id) {
        const totalSections = Number(entry.total_sections || 0);
        const completedSections = Number(entry.completed_sections || 0);
        const sectionPercent =
          totalSections > 0
            ? Math.round((completedSections / totalSections) * 100)
            : Number(entry.percent_complete || 0);
        map.set(entry.course_id, {
          percent: sectionPercent,
          completedSections,
          totalSections,
          completedLessons: Number(entry.completed_lessons || 0),
          totalLessons: Number(entry.total_lessons || 0),
        });
      }
    });
    return map;
  }, [progressSummaryQuery.data]);

  const courses = personalizedQuery.data?.courses || [];
  const heroCourse = courses[0];
  const restCourses = courses.slice(1);
  const reviewQueue = personalizedQuery.data?.review_queue || [];
  const isPreview = Boolean(personalizedQuery.data?.meta?.preview);

  const openCourse = (course: PersonalizedPathCourse) => {
    if (course.locked) {
      navigate("/subscriptions");
      return;
    }
    onCourseClick?.(course.id, Number(course.path || 0) || undefined);
  };

  const getCourseMetrics = (course: PersonalizedPathCourse) => {
    const progress = progressByCourse.get(course.id);
    const fallbackCompletedLessons = Number(course.completed_lessons || 0);
    const fallbackTotalLessons = Number(course.total_lessons || 0);
    const completedLessons =
      progress?.completedLessons ?? fallbackCompletedLessons;
    const totalLessons = progress?.totalLessons ?? fallbackTotalLessons;
    const completedSections =
      progress?.completedSections ?? Number(course.completed_sections || 0);
    const totalSections =
      progress?.totalSections ?? Number(course.total_sections || 0);
    const percent =
      progress?.percent ??
      (totalLessons > 0
        ? Math.round((completedLessons / Math.max(totalLessons, 1)) * 100)
        : Number(course.completion_percent || 0));
    const estimatedMinutes =
      Number(course.estimated_minutes || 0) > 0
        ? Number(course.estimated_minutes || 0)
        : Math.max(totalLessons * 4, 8);
    return {
      percent,
      completedLessons,
      totalLessons,
      completedSections,
      totalSections,
      estimatedMinutes,
    };
  };

  if (!isAuthenticated) {
    navigate(`/login?returnUrl=${encodeURIComponent("/personalized-path")}`);
    return null;
  }
  if (!profileLoading && !questionnaireCompleted) {
    navigate("/onboarding");
    return null;
  }

  if (profileLoading || personalizedQuery.isLoading) {
    return (
      <GlassCard padding="lg" className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-[color:var(--input-bg,#f3f4f6)]" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-[color:var(--input-bg,#f3f4f6)]"
            />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (personalizedQuery.isError) {
    return (
      <GlassCard
        padding="md"
        className="text-center text-sm text-[color:var(--error,#dc2626)]"
      >
        {t("personalizedPath.errors.recommendationsFailed")}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">
      {heroCourse && (
        <GlassCard
          padding="lg"
          className="relative overflow-hidden border border-[color:var(--primary,#1d5330)]/20"
        >
          {(() => {
            const metrics = getCourseMetrics(heroCourse);
            return (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-color,#d1d5db)]/70 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                      {t("personalizedPath.title")}
                    </p>
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      {(
                        personalizedQuery.data?.meta?.onboarding_goals || []
                      ).join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      {t("personalizedPath.overallCompletion", {
                        value:
                          personalizedQuery.data?.meta?.overall_completion ?? 0,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshMutation.mutate()}
                      disabled={refreshMutation.isPending}
                      className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold"
                    >
                      {refreshMutation.isPending
                        ? t("personalizedPath.refreshing")
                        : t("personalizedPath.refresh")}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                      {t("personalizedPath.continue")}
                    </p>
                    <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                      {heroCourse.title}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                      {heroCourse.reason}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--primary,#1d5330)]/10 px-2 py-0.5">
                        <MonevoIcon
                          name={courseIcon(heroCourse.path_title)}
                          size={12}
                        />
                        {heroCourse.path_title ||
                          t("personalizedPath.pathLabel")}
                      </span>
                      <span>
                        {t("personalizedPath.eta", {
                          minutes: metrics.estimatedMinutes,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressRing value={metrics.percent} />
                    <div className="min-w-[90px] text-right text-xs text-[color:var(--muted-text,#6b7280)]">
                      {metrics.totalSections && metrics.totalSections > 0 ? (
                        <div>
                          {metrics.completedSections ?? 0}/
                          {metrics.totalSections} sections
                        </div>
                      ) : (
                        <div>
                          {metrics.completedLessons}/{metrics.totalLessons}{" "}
                          lessons
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openCourse(heroCourse)}
                      className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {heroCourse.locked
                        ? t("personalizedPath.unlock")
                        : t("personalizedPath.open")}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
          {heroCourse.locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[color:var(--primary,#1d5330)]">
                {t("personalizedPath.locked")}
              </span>
            </div>
          )}
        </GlassCard>
      )}

      {!heroCourse && (
        <GlassCard padding="md" className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
            {t("personalizedPath.title")}
          </p>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {(personalizedQuery.data?.meta?.onboarding_goals || []).join(" • ")}
          </p>
        </GlassCard>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
          {t("personalizedPath.recommendedForYou")}
        </h4>
        <div className="relative">
          {restCourses.map((course, index) => {
            const metrics = getCourseMetrics(course);
            const percent = metrics.percent;
            const focusHint =
              percent < 30
                ? "Focus on first two sections to build momentum."
                : percent < 70
                  ? "You are midway - complete remaining sections to unlock mastery."
                  : "Almost done - finish the last section and review queue.";
            const starterTasks = Array.isArray(course.starter_tasks)
              ? course.starter_tasks.slice(0, 2)
              : [];
            return (
              <div
                key={course.id}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                <div className="relative flex w-10 shrink-0 justify-center">
                  {index < restCourses.length - 1 && (
                    <span className="absolute top-9 bottom-0 w-[2px] bg-gradient-to-b from-[color:var(--primary,#1d5330)]/50 to-[color:var(--border-color,#d1d5db)]" />
                  )}
                  <div className="relative z-10 mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--primary,#1d5330)]/30 bg-[color:var(--card-bg,#ffffff)]">
                    <MonevoIcon
                      name={courseIcon(course.path_title)}
                      size={14}
                      className="text-[color:var(--primary,#1d5330)]"
                    />
                  </div>
                </div>

                <GlassCard
                  padding="md"
                  className="relative flex-1 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                        {course.path_title}
                      </p>
                      <p className="font-semibold">{course.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                        {course.reason}
                      </p>
                      <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                        {focusHint}
                      </p>
                      <div className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                        {metrics.totalSections && metrics.totalSections > 0 ? (
                          <>
                            {metrics.completedSections ?? 0}/
                            {metrics.totalSections} sections •{" "}
                            {metrics.completedLessons}/{metrics.totalLessons}{" "}
                            lessons
                          </>
                        ) : (
                          <>
                            {metrics.completedLessons}/{metrics.totalLessons}{" "}
                            lessons
                          </>
                        )}
                      </div>
                      {course.next_lesson_title && (
                        <div className="mt-1 text-xs text-[color:var(--primary,#1d5330)]">
                          Next: {course.next_lesson_title}
                        </div>
                      )}
                      {!course.next_lesson_title && starterTasks.length > 0 && (
                        <ul className="mt-1 space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                          {starterTasks.map((task, taskIdx) => (
                            <li
                              key={`${course.id}-task-${taskIdx}`}
                              className="flex items-start gap-1"
                            >
                              <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-[color:var(--primary,#1d5330)]/70" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <ProgressRing value={percent} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                      {t("personalizedPath.eta", {
                        minutes: metrics.estimatedMinutes,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCourse(course)}
                      className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1.5 text-xs font-semibold"
                    >
                      {course.locked
                        ? t("personalizedPath.unlock")
                        : t("personalizedPath.open")}
                    </button>
                  </div>
                  {course.locked && (
                    <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />
                  )}
                </GlassCard>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
          {t("personalizedPath.skillsToReinforce")}
        </h4>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {reviewQueue.length === 0 ? (
            <GlassCard
              padding="sm"
              className="text-xs text-[color:var(--muted-text,#6b7280)]"
            >
              {t("personalizedPath.noSkillsDue")}
            </GlassCard>
          ) : (
            reviewQueue.map((item, idx) => (
              <GlassCard
                key={`${item.skill || "skill"}-${idx}`}
                padding="sm"
                className="min-w-[180px]"
              >
                <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                  {item.skill}
                </p>
                <p className="text-sm font-semibold">
                  {t("personalizedPath.skillScore", {
                    value: item.proficiency ?? 0,
                  })}
                </p>
              </GlassCard>
            ))
          )}
        </div>
      </section>

      {isPreview && personalizedQuery.data?.upgrade_prompt && (
        <GlassCard padding="md" className="text-center">
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {personalizedQuery.data.upgrade_prompt}
          </p>
          <button
            type="button"
            className="mt-3 rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigate("/subscriptions")}
          >
            {t("personalizedPath.upgrade")}
          </button>
        </GlassCard>
      )}

      <GlassCard padding="md" className="text-center">
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("personalizedPath.basedOnOnboarding")}{" "}
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="font-semibold text-[color:var(--primary,#1d5330)] underline decoration-[color:var(--primary,#1d5330)]/40 underline-offset-2 transition hover:text-[color:var(--primary,#1d5330)]/85 hover:decoration-[color:var(--primary,#1d5330)]/60"
          >
            {t("personalizedPath.updatePreferences")}
          </button>
        </p>
      </GlassCard>
    </div>
  );
}

export default PersonalizedPathContent;
