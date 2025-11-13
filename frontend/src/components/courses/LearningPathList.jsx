import React from "react";
import { GlassCard } from "components/ui";

function LearningPathList({
  learningPaths,
  onCourseClick,
  showCourseImages = true,
}) {
  if (!learningPaths?.length) {
    return (
      <GlassCard padding="lg" className="bg-[color:var(--card-bg,#ffffff)]/60 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
        No learning paths available yet.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-10">
      {learningPaths.map((path) => (
        <GlassCard
          key={path.id}
          padding="lg"
          className="group space-y-5"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
          <div className="relative">
          <header className="flex items-baseline justify-between gap-3">
            <h3 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
              {path.title || "Custom Path"}
            </h3>
            {path.description && (
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {path.description}
              </p>
            )}
          </header>

          <div className="space-y-4">
            {path.courses.map((course) => (
              <GlassCard
                key={course.id}
                padding="none"
                className="group flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-1"
                onClick={() => onCourseClick?.(course.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCourseClick?.(course.id);
                }}
                role="button"
                tabIndex={0}
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
                    <span>{course.lesson_count || 0} lessons</span>
                    <span className="text-[color:var(--primary,#1d5330)]">
                      View details →
                    </span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export default LearningPathList;

