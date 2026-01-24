import React, { useEffect, useState, useMemo, useDeferredValue } from "react";
import axios from "axios";
import LearningPathList from "components/courses/LearningPathList";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";
import { useProgressMetrics } from "hooks/useProgressMetrics";
import { useAnalytics } from "hooks/useAnalytics";
import { formatNumber, getLocale } from "utils/format";

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
};

const AllTopics = ({
  onCourseClick,
  navigationControls = null,
}: {
  onCourseClick?: (courseId: number, pathId: number) => void;
  navigationControls?: React.ReactNode;
}) => {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [activePathId, setActivePathId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("default");
  const [filterBy, setFilterBy] = useState("all");
  const { getAccessToken } = useAuth();
  const { trackEvent } = useAnalytics();
  const locale = getLocale();

  const { getCourseProgress, getPathProgress } = useProgressMetrics();
  const deferredPaths = useDeferredValue(learningPaths);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        setLoading(true);
        const response = await axios.get<LearningPath[]>(
          `${BACKEND_URL}/paths/`,
          {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
        );

        setLearningPaths(
          response.data.map((path: unknown): LearningPath => {
            const p = path as Partial<LearningPath>;
            return {
              id: Number(p.id) || 0,
              title: String(p.title || ""),
              description: p.description ? String(p.description) : undefined,
              image: p.image ? String(p.image) : undefined,
              courses: Array.isArray(p.courses) ? p.courses.map((course: unknown): LearningPathCourse => {
                const c = course as Partial<LearningPathCourse>;
                return {
                  id: Number(c.id) || 0,
                  title: String(c.title || ""),
                  description: c.description ? String(c.description) : undefined,
                  image: c.image ? String(c.image) : undefined,
                  lesson_count: c.lesson_count ? Number(c.lesson_count) : undefined,
                  total_lessons: c.total_lessons ? Number(c.total_lessons) : undefined,
                  totalLessons: c.totalLessons ? Number(c.totalLessons) : undefined,
                  lessons: Array.isArray(c.lessons) ? c.lessons : undefined,
                };
              }) : undefined,
              progress: p.progress ? Number(p.progress) : undefined,
              courseProgresses: Array.isArray(p.courseProgresses) ? p.courseProgresses.map(Number) : undefined,
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
        setError("Failed to load learning paths. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPaths();
  }, [getAccessToken]);

  const handleTogglePath = (pathId: number | string) => {
    setActivePathId((prev) => (prev === pathId ? null : pathId));
  };

  // Enhanced paths with progress data and sorting/filtering
  const enhancedPaths = useMemo(() => {
    let paths = deferredPaths.map((path) => {
      const coursesInPath = path.courses || [];
      const courseProgresses = coursesInPath.map((course) =>
        getCourseProgress(course)
      );
      const pathProgress = getPathProgress(path);

      return {
        ...path,
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
      paths.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      );
    }

    return paths;
  }, [deferredPaths, getCourseProgress, getPathProgress, sortBy, filterBy]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-8 text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading learning paths...
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
            Sort by:
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
            aria-label="Sort learning paths"
          >
            <option value="default">Default</option>
            <option value="name">Name (A-Z)</option>
            <option value="easiest">Easiest First</option>
            <option value="hardest">Hardest First</option>
            <option value="progress-asc">Progress (Low to High)</option>
            <option value="progress-desc">Progress (High to Low)</option>
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
            Filter:
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
            aria-label="Filter learning paths"
          >
            <option value="all">All Topics</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </GlassCard>

      {enhancedPaths.map((path) => (
        <GlassCard key={String(path.id)} id={String(path.id)} className="group" padding="lg">
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
                  <h3 className="flex items-center gap-2 text-xl font-semibold text-[color:var(--accent,#111827)]">
                    <span>{path.title}</span>
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
                          Path Progress
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
                          aria-label={`${formatNumber(path.progress ?? 0, locale, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}% complete`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <GlassButton
                variant={activePathId === path.id ? "primary" : "success"}
                onClick={() => handleTogglePath(path.id)}
                icon={activePathId === path.id ? "▼" : "▶"}
                aria-expanded={activePathId === path.id}
                aria-controls={`path-${path.id}-courses`}
              >
                {activePathId === path.id ? "Hide Courses" : "View Courses"}
              </GlassButton>
            </div>

            {activePathId === path.id && (
              <div
                id={`path-${path.id}-courses`}
                className="mt-6"
                role="region"
                aria-label={`Courses in ${path.title}`}
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
      ))}
    </div>
  );
};

export default AllTopics;
