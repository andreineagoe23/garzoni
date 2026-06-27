import React, { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import apiClient from "services/httpClient";
import {
  buildProgressByCourse,
  buildSkillPracticeHref,
  type CoachBriefResponse,
  derivePersonalizedPathState,
  fetchCoachBrief,
  getCourseMetrics,
  masteryLevelLabel,
  shouldAutoRefreshEmptyPath,
} from "@garzoni/core";
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
        className="text-[color:var(--color-brand-primary)]"
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
        { is_questionnaire_completed?: boolean } | undefined
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
    mutationFn: async (_opts?: { silent?: boolean }) => {
      await apiClient.post("/personalized-path/refresh/");
    },
    onSuccess: async (_data, variables) => {
      if (!variables?.silent) toast.success(t("personalizedPath.refreshed"));
      await personalizedQuery.refetch();
    },
    onError: () => {
      toast.error(t("personalizedPath.errors.recommendationsFailed"));
    },
  });

  const coachBriefQuery = useQuery<CoachBriefResponse>({
    queryKey: ["coachBrief"],
    queryFn: async () => (await fetchCoachBrief()).data,
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: 86_400_000, // 24h
    retry: false,
  });

  const progressByCourse = useMemo(
    () => buildProgressByCourse(progressSummaryQuery.data),
    [progressSummaryQuery.data]
  );

  const { courses, heroCourse, restCourses, reviewQueue, isPreview } = useMemo(
    () => derivePersonalizedPathState(personalizedQuery.data),
    [personalizedQuery.data]
  );
  const autoRefreshTriggered = useRef(false);

  useEffect(() => {
    if (
      !shouldAutoRefreshEmptyPath({
        questionnaireCompleted,
        personalizedFetchSucceeded: personalizedQuery.isSuccess,
        coursesLength: courses.length,
        isRefreshing: refreshMutation.isPending,
        alreadyTriggered: autoRefreshTriggered.current,
      })
    ) {
      return;
    }
    autoRefreshTriggered.current = true;
    refreshMutation.mutate({ silent: true });
  }, [
    courses.length,
    personalizedQuery.isSuccess,
    questionnaireCompleted,
    refreshMutation,
  ]);

  const openCourse = (course: PersonalizedPathCourse) => {
    if (course.locked) {
      navigate("/subscriptions");
      return;
    }
    onCourseClick?.(course.id, Number(course.path || 0) || undefined);
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
        className="text-center text-sm text-[color:var(--color-state-error)]"
      >
        {t("personalizedPath.errors.recommendationsFailed")}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">
      {/* Coach Brief card — Plus/Pro weekly coaching note */}
      {coachBriefQuery.data?.brief && (
        <GlassCard padding="md" className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[color:#2a7347]">
              {t("coachBrief.title", "Your Weekly Coach Brief")}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-content-primary whitespace-pre-line">
            {coachBriefQuery.data.brief}
          </p>
        </GlassCard>
      )}

      {heroCourse && (
        <GlassCard padding="lg" className="app-card relative overflow-hidden">
          {(() => {
            const metrics = getCourseMetrics(heroCourse, progressByCourse);
            return (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--color-border-default)]/70 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-content-primary">
                      {t("personalizedPath.title")}
                    </p>
                    <p className="text-xs text-content-muted">
                      {(
                        personalizedQuery.data?.meta?.onboarding_goals || []
                      ).join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-content-muted">
                      {t("personalizedPath.overallCompletion", {
                        value:
                          personalizedQuery.data?.meta?.overall_completion ?? 0,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => refreshMutation.mutate(undefined)}
                      disabled={refreshMutation.isPending}
                      className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1 text-xs font-semibold"
                    >
                      {refreshMutation.isPending
                        ? t("personalizedPath.refreshing")
                        : t("personalizedPath.refresh")}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="app-eyebrow mb-1">
                      {t("personalizedPath.continue")}
                    </p>
                    <h3 className="app-display text-xl text-content-primary">
                      {heroCourse.title}
                    </h3>
                    <p className="mt-1 text-sm text-content-muted">
                      {heroCourse.reason}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-content-muted">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-brand-primary)]/10 px-2 py-0.5">
                        <GarzoniIcon
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
                    <div className="min-w-[90px] text-right text-xs text-content-muted">
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
                      className="app-cta-btn !w-auto px-5 py-2 !h-auto text-sm"
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
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[color:var(--color-brand-primary)]">
                {t("personalizedPath.locked")}
              </span>
            </div>
          )}
        </GlassCard>
      )}

      {!heroCourse && (
        <GlassCard padding="md" className="space-y-2">
          <p className="text-sm font-semibold text-content-primary">
            {t("personalizedPath.title")}
          </p>
          <p className="text-xs text-content-muted">
            {(personalizedQuery.data?.meta?.onboarding_goals || []).join(" • ")}
          </p>
        </GlassCard>
      )}

      <section className="space-y-3">
        <h4 className="app-eyebrow">
          {t("personalizedPath.recommendedForYou")}
        </h4>
        <div className="relative">
          {restCourses.map((course, index) => {
            const metrics = getCourseMetrics(course, progressByCourse);
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
                    <span className="absolute top-9 bottom-0 w-[2px] bg-gradient-to-b from-[color:var(--color-brand-primary)]/50 to-[color:var(--color-border-default)]" />
                  )}
                  <div className="relative z-10 mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-brand-primary)]/30 bg-[color:var(--color-surface-card)]">
                    <GarzoniIcon
                      name={courseIcon(course.path_title)}
                      size={14}
                      className="text-[color:var(--color-brand-primary)]"
                    />
                  </div>
                </div>

                <GlassCard
                  padding="md"
                  className="app-card relative flex-1 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-content-muted">
                        {course.path_title}
                      </p>
                      <p className="font-semibold">{course.title}</p>
                      <p className="mt-1 text-xs text-content-muted">
                        {course.reason}
                      </p>
                      <p className="mt-2 text-xs text-content-muted">
                        {focusHint}
                      </p>
                      <div className="mt-2 text-xs text-content-muted">
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
                        <div className="mt-1 text-xs text-[color:var(--color-brand-primary)]">
                          Next: {course.next_lesson_title}
                        </div>
                      )}
                      {!course.next_lesson_title && starterTasks.length > 0 && (
                        <ul className="mt-1 space-y-1 text-xs text-content-muted">
                          {starterTasks.map((task, taskIdx) => (
                            <li
                              key={`${course.id}-task-${taskIdx}`}
                              className="flex items-start gap-1"
                            >
                              <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-primary)]/70" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <ProgressRing value={percent} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-content-muted">
                      {t("personalizedPath.eta", {
                        minutes: metrics.estimatedMinutes,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCourse(course)}
                      className="rounded-full bg-[#1d5330] px-3 py-1.5 text-xs font-semibold text-white shadow shadow-[#1d5330]/30 hover:bg-[#2a7347] transition"
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
        <h4 className="app-eyebrow">
          {t("personalizedPath.skillsToReinforce")}
        </h4>
        {reviewQueue.length === 0 ? (
          <GlassCard
            padding="sm"
            className="app-card-sm text-xs text-content-muted"
          >
            {t("personalizedPath.noSkillsDue")}
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reviewQueue.map((item, idx) => {
              const pct = item.proficiency ?? 0;
              const band = item.level_band ?? "not_started";
              const label = masteryLevelLabel(t, band);
              const dueAt = item.due_at ? new Date(item.due_at) : null;
              const now = new Date();
              const daysUntil = dueAt
                ? Math.ceil((dueAt.getTime() - now.getTime()) / 86400000)
                : 0;
              const dueLabel =
                !dueAt || dueAt <= now
                  ? t("personalizedPath.due.now")
                  : daysUntil === 1
                    ? t("personalizedPath.due.tomorrow")
                    : t("personalizedPath.due.inDaysLong", {
                        count: daysUntil,
                      });

              const bandColor: Record<string, string> = {
                not_started: "text-content-muted",
                attempted: "text-[#e6c87a]",
                familiar: "text-blue-400",
                proficient: "text-[color:var(--color-brand-primary)]",
                mastered: "text-emerald-500",
              };
              const bandBg: Record<string, string> = {
                not_started: "bg-slate-500/15",
                attempted: "bg-yellow-400/15",
                familiar: "bg-blue-500/15",
                proficient: "bg-[color:var(--color-brand-primary)]/10",
                mastered: "bg-emerald-500/15",
              };

              return (
                <GlassCard
                  key={`${item.skill || "skill"}-${idx}`}
                  padding="sm"
                  className="app-card-sm flex items-center gap-3"
                >
                  {/* Progress ring */}
                  <ProgressRing value={pct} />

                  {/* Skill info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-content-primary">
                      {item.skill}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${bandBg[band] ?? ""} ${bandColor[band] ?? ""}`}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-content-muted">{pct}%</span>
                    </div>
                  </div>

                  {/* Due + practice */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-content-muted">
                      {dueLabel}
                    </span>
                    <a
                      href={buildSkillPracticeHref(item.skill || "")}
                      className="rounded-full bg-[color:var(--color-brand-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-brand-primary)] hover:bg-[color:var(--color-brand-primary)]/20 transition"
                    >
                      Practice →
                    </a>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {isPreview && personalizedQuery.data?.upgrade_prompt && (
        <GlassCard padding="md" className="app-card text-center">
          <p className="text-sm text-content-muted">
            {personalizedQuery.data.upgrade_prompt}
          </p>
          <button
            type="button"
            className="app-cta-btn mt-3 !w-auto px-6 py-2 !h-auto text-sm"
            onClick={() => navigate("/subscriptions")}
          >
            {t("personalizedPath.upgrade")}
          </button>
        </GlassCard>
      )}

      <GlassCard padding="md" className="app-card text-center">
        <p className="text-sm text-content-muted">
          {t("personalizedPath.basedOnOnboarding")}{" "}
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="font-semibold text-[color:var(--color-brand-primary)] underline decoration-[color:var(--color-brand-primary)]/40 underline-offset-2 transition hover:text-[color:var(--color-brand-primary)]/85 hover:decoration-[color:var(--color-brand-primary)]/60"
          >
            {t("personalizedPath.updatePreferences")}
          </button>
        </p>
      </GlassCard>
    </div>
  );
}

export default PersonalizedPathContent;
