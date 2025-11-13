import React from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "components/ui";

function CourseList({ courses }) {
  const navigate = useNavigate();

  if (!courses?.length) {
    return (
      <GlassCard padding="md" className="bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)]">
        No courses available yet.
      </GlassCard>
    );
  }

  return (
    <ul className="grid gap-4">
      {courses.map((course) => (
        <GlassCard
          key={course.id}
          padding="md"
          className="group cursor-pointer text-[color:var(--text-color,#111827)] transition hover:-translate-y-1 hover:shadow-lg hover:shadow-[color:var(--primary,#2563eb)]/20 focus-within:ring-2 focus-within:ring-[color:var(--accent,#2563eb)]/40"
          onClick={() => navigate(`/lessons/${course.id}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(`/lessons/${course.id}`);
          }}
          tabIndex={0}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
          <div className="relative">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {course.title}
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] group-hover:text-[color:var(--accent,#2563eb)]">
              View lesson
            </span>
          </div>
          {course.description && (
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              {course.description}
            </p>
          )}
          </div>
        </GlassCard>
      ))}
    </ul>
  );
}

export default CourseList;

