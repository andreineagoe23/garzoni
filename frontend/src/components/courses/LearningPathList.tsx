import React from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "components/ui";

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
  title?: string;
  description?: string;
  courses?: LearningPathCourse[];
  access_tier?: string;
  is_locked?: boolean;
};

function getLessonCount(course: LearningPathCourse) {
  if (!course) return 0;
  const fromBackend =
    course.lesson_count ??
    course.total_lessons ??
    course.totalLessons ??
    (Array.isArray(course.lessons) ? course.lessons.length : undefined);
  const parsed = Number(fromBackend);
  return Number.isFinite(parsed) ? parsed : 0;
}

function LearningPathList({
  learningPaths,
  onCourseClick,
  showCourseImages = true }: {
  learningPaths?: LearningPath[];
  onCourseClick?: (courseId: number, pathId: number) => void;
  showCourseImages?: boolean;
}) {
  const { t } = useTranslation();
  if (!learningPaths?.length) {
    return (
      <GlassCard
        padding="lg"
        className="bg-[color:var(--card-bg,#ffffff)]/60 text-center text-sm text-[color:var(--muted-text,#6b7280)]"
      >
        {t("courses.learningPath.noPathsAvailable")}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-10">
      {learningPaths.map((path) => {
        const courses = Array.isArray(path.courses) ? path.courses : [];
        const isLocked = Boolean(path.is_locked);
        return (
          <GlassCard key={path.id} padding="lg" className="group space-y-5">
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
            <div className="relative">
              <header className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
                  {path.title || t("courses.learningPath.customPath")}
                </h3>
                {path.description && (
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    {path.description}
                  </p>
                )}
              </header>
              <div className="space-y-4">
                {courses.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                    {t("courses.learningPath.noCoursesInPath")}
                  </div>
                )}
                {courses.map((course) => {
                  const lessonCount = getLessonCount(course);

                  return (
                    <GlassCard
                      key={course.id}
                      padding="none"
                      className={`group flex flex-col overflow-hidden transition ${
                        isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:-translate-y-1"
                      }`}
                      onClick={() => {
                        if (isLocked) return;
                        onCourseClick?.(Number(course.id), Number(path.id));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !isLocked)
                          onCourseClick?.(Number(course.id), Number(path.id));
                      }}
                      role="button"
                      tabIndex={isLocked ? -1 : 0}
                      aria-disabled={isLocked}
                    >
                      {showCourseImages && course.image && (
                        <div className="relative h-40 w-full overflow-hidden">
                          <img
                            src={course.image}
                            alt={course.title}
                            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                        </div>
                      )}

                      <div className="flex flex-1 flex-col gap-3 px-4 py-5">
                        <h4 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                          {course.title}
                        </h4>
                        {course.description && (
                          <p className="flex-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                            {course.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                          <span>
                            {t("courses.learningPath.lesson", { count: lessonCount })}
                          </span>
                          <span className="text-[color:var(--primary,#1d5330)]">
                            {t("courses.learningPath.viewDetails")}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

export default LearningPathList;
