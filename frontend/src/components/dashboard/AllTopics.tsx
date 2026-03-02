import React, { useEffect, useState, useMemo, useDeferredValue } from "react";
import LearningPathList from "components/courses/LearningPathList";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassCard } from "components/ui";
import apiClient from "services/httpClient";
import { useProgressMetrics } from "hooks/useProgressMetrics";
import { useAnalytics } from "hooks/useAnalytics";
import { formatNumber, getLocale } from "utils/format";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type LearningPathCourse = {
  id: number;
  title: string;
  description?: string;
  image?: string;
  lesson_count?: number;
  total_lessons?: number;
  totalLessons?: number;
  lessons?: unknown[];
};

type LearningPath = {
  id: number;
  title: string;
  description?: string;
  image?: string;
  courses?: LearningPathCourse[];
  progress?: number;
  courseProgresses?: number[];
  access_tier?: string;
  sort_order?: number;
  is_locked?: boolean;
};

const AllTopics = ({
  onCourseClick,
  navigationControls = null,
}: {
  onCourseClick?: (courseId: number, pathId: number) => void;
  navigationControls?: React.ReactNode;
}) => {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [activePathId, setActivePathId] = useState<string | number | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("default");
  const [filterBy, setFilterBy] = useState("all");
  const { getAccessToken, entitlements } = useAuth();
  const { trackEvent } = useAnalytics();
  const locale = getLocale();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const planRank = (plan?: string | null) => {
    if (plan === "plus") return 1;
    if (plan === "pro") return 2;
    return 0;
  };

  const { getCourseProgress, getPathProgress } = useProgressMetrics();
  const deferredPaths = useDeferredValue(learningPaths);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<LearningPath[]>("/paths/");

        setLearningPaths(
          response.data.map((path: unknown): LearningPath => {
            const p = path as Partial<LearningPath>;
            return {
              id: Number(p.id) || 0,
              title: String(p.title || ""),
              description: p.description ? String(p.description) : undefined,
              image: p.image ? String(p.image) : undefined,
              access_tier: p.access_tier ? String(p.access_tier) : undefined,
              sort_order:
                typeof p.sort_order === "number"
                  ? Number(p.sort_order)
                  : undefined,
              is_locked:
                typeof p.is_locked === "boolean" ? p.is_locked : undefined,
              courses: Array.isArray(p.courses)
                ? p.courses.map((course: unknown): LearningPathCourse => {
                    const c = course as Partial<LearningPathCourse>;
                    return {
                      id: Number(c.id) || 0,
                      title: String(c.title || ""),
                      description: c.description
                        ? String(c.description)
                        : undefined,
                      image: c.image ? String(c.image) : undefined,
                      lesson_count: c.lesson_count
                        ? Number(c.lesson_count)
                        : undefined,
                      total_lessons: c.total_lessons
                        ? Number(c.total_lessons)
                        : undefined,
                      totalLessons: c.totalLessons
                        ? Number(c.totalLessons)
                        : undefined,
                      lessons: Array.isArray(c.lessons) ? c.lessons : undefined,
                    };
                  })
                : undefined,
              progress: p.progress ? Number(p.progress) : undefined,
              courseProgresses: Array.isArray(p.courseProgresses)
                ? p.courseProgresses.map(Number)
                : undefined,
            };
          })
        );

        const anchor = sessionStorage.getItem("scrollToPathId");
        if (anchor) {
          setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
              el.classList.add("ring-2", "ring-[color:var(--accent,#2563eb)]");
              setActivePathId(anchor);
              setTimeout(
                () =>
                  el.classList.remove(
                    "ring-2",
                    "ring-[color:var(--accent,#2563eb)]"
                  ),
                2000
              );
            }
            sessionStorage.removeItem("scrollToPathId");
          }, 500);
        }
      } catch (err) {
        console.error("Error fetching learning paths:", err);
        setError(t("allTopics.error"));
      } finally {
        setLoading(false);
      }
    };

    fetchPaths();
  }, [getAccessToken, t]);

  const handleTogglePath = (pathId: number | string, isLocked?: boolean) => {
    if (isLocked) return;
    setActivePathId((prev) => (prev === pathId ? null : pathId));
  };

  // Enhanced paths with progress data and sorting/filtering
  const enhancedPaths = useMemo(() => {
    let paths = deferredPaths.map((path) => {
      const isLocked =
        typeof path.is_locked === "boolean"
          ? path.is_locked
          : planRank(entitlements?.plan) <
            planRank(path.access_tier || "starter");
      const coursesInPath = path.courses || [];
      const courseProgresses = coursesInPath.map((course) =>
        getCourseProgress(course)
      );
      const pathProgress = getPathProgress(path);

      return {
        ...path,
        is_locked: isLocked,
        progress: pathProgress,
        courseProgresses: courseProgresses,
      };
    });

    // Apply filters
    if (filterBy === "in-progress") {
      paths = paths.filter((p) => p.progress > 0 && p.progress < 100);
    } else if (filterBy === "not-started") {
      paths = paths.filter((p) => p.progress === 0);
    } else if (filterBy === "completed") {
      paths = paths.filter((p) => p.progress === 100);
    }

    // Apply sorting
    if (sortBy === "progress-asc") {
      paths.sort((a, b) => a.progress - b.progress);
    } else if (sortBy === "progress-desc") {
      paths.sort((a, b) => b.progress - a.progress);
    } else if (sortBy === "easiest") {
      // Sort by highest progress (easiest = most progress)
      paths.sort((a, b) => b.progress - a.progress);
    } else if (sortBy === "hardest") {
      // Sort by lowest progress (hardest = least progress)
      paths.sort((a, b) => a.progress - b.progress);
    } else if (sortBy === "name") {
      paths.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return paths;
  }, [
    deferredPaths,
    entitlements?.plan,
    getCourseProgress,
    getPathProgress,
    sortBy,
    filterBy,
  ]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-8 text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          {t("allTopics.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-6 py-8 text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sorting and Filtering Controls */}
      <GlassCard
        padding="md"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-3 sm:flex-1">
          <label
            htmlFor="sort-select"
            className="text-sm font-medium text-[color:var(--text-color,#111827)]"
          >
            {t("allTopics.sortByLabel")}
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => {
              const newSort = e.target.value;
              setSortBy(newSort);
              trackEvent("sort_change", { sort_by: newSort });
            }}
            className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            aria-label={t("allTopics.sortByAria")}
          >
            <option value="default">{t("allTopics.sort.default")}</option>
            <option value="name">{t("allTopics.sort.name")}</option>
            <option value="easiest">{t("allTopics.sort.easiest")}</option>
            <option value="hardest">{t("allTopics.sort.hardest")}</option>
            <option value="progress-asc">
              {t("allTopics.sort.progressAsc")}
            </option>
            <option value="progress-desc">
              {t("allTopics.sort.progressDesc")}
            </option>
          </select>
        </div>
        {navigationControls ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            {navigationControls}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 sm:flex-1 sm:justify-end">
          <label
            htmlFor="filter-select"
            className="text-sm font-medium text-[color:var(--text-color,#111827)]"
          >
            {t("allTopics.filterLabel")}
          </label>
          <select
            id="filter-select"
            value={filterBy}
            onChange={(e) => {
              const newFilter = e.target.value;
              setFilterBy(newFilter);
              trackEvent("filter_change", { filter_by: newFilter });
            }}
            className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            aria-label={t("allTopics.filterAria")}
          >
            <option value="all">{t("allTopics.filter.all")}</option>
            <option value="not-started">
              {t("allTopics.filter.notStarted")}
            </option>
            <option value="in-progress">
              {t("allTopics.filter.inProgress")}
            </option>
            <option value="completed">{t("allTopics.filter.completed")}</option>
          </select>
        </div>
      </GlassCard>

      {enhancedPaths.map((path) => {
        const isLocked = Boolean(path.is_locked);
        const requiredPlan = path.access_tier === "pro" ? "Pro" : "Plus";

        return (
          <GlassCard
            key={String(path.id)}
            id={String(path.id)}
            className="group"
            padding="lg"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  {path.image && (
                    <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f3f4f6)] shadow-md sm:block">
                      <img
                        src={path.image}
                        alt={path.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-[color:var(--accent,#111827)]">
                      {path.title}
                    </h3>
                    {path.description && (
                      <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-text,#6b7280)]">
                        {path.description}
                      </p>
                    )}
                    {/* Progress indicator per path */}
                    {path.progress !== undefined && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[color:var(--muted-text,#6b7280)]">
                            {t("allTopics.pathProgress")}
                          </span>
                          <span className="font-semibold text-[color:var(--text-color,#111827)]">
                            {formatNumber(path.progress ?? 0, locale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                            %
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/70 transition-[width] duration-500"
                            style={{ width: `${path.progress}%` }}
                            role="progressbar"
                            aria-valuenow={path.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={t("allTopics.progressAria", {
                              value: formatNumber(path.progress ?? 0, locale, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isLocked && (
                    <GlassButton
                      variant={activePathId === path.id ? "primary" : "success"}
                      onClick={() => handleTogglePath(path.id, false)}
                      icon={activePathId === path.id ? "▼" : "▶"}
                      aria-expanded={activePathId === path.id}
                      aria-controls={`path-${path.id}-courses`}
                    >
                      {activePathId === path.id
                        ? t("allTopics.hideCourses")
                        : t("allTopics.viewCourses")}
                    </GlassButton>
                  )}
                  {isLocked && (
                    <GlassButton
                      variant="primary"
                      icon="⚡"
                      onClick={() => {
                        trackEvent("upgrade_click", {
                          source: "path_lock",
                          path: path.title,
                        });
                        navigate("/subscriptions");
                      }}
                    >
                      {t("allTopics.upgradeTo", {
                        plan: requiredPlan,
                      })}
                    </GlassButton>
                  )}
                </div>
              </div>

              {activePathId === path.id && (
                <div
                  id={`path-${path.id}-courses`}
                  className="mt-6"
                  role="region"
                  aria-label={t("allTopics.coursesIn", {
                    title: path.title,
                  })}
                >
                  <LearningPathList
                    learningPaths={[path]}
                    onCourseClick={onCourseClick}
                    showCourseImages={false}
                  />
                </div>
              )}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};

export default AllTopics;
