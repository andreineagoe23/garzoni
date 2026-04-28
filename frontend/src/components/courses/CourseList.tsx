import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { GlassCard } from "components/ui";

type CourseListItem = {
  id: number;
  title: string;
  description?: string;
};

function CourseList({ courses }: { courses?: CourseListItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathId } = useParams();
  const pathIdSegment = pathId ? `/courses/${pathId}` : null;

  if (!courses?.length) {
    return (
      <GlassCard padding="md" className="bg-surface-card text-content-muted">
        {t("courses.list.noCoursesAvailable")}
      </GlassCard>
    );
  }

  return (
    <ul className="grid gap-4">
      {courses.map((course) => (
        <GlassCard
          key={course.id}
          padding="md"
          className="app-card group cursor-pointer transition hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)] focus-within:ring-2 focus-within:ring-[#2a7347]/40"
          onClick={() =>
            navigate(
              pathIdSegment
                ? `${pathIdSegment}/lessons/${course.id}/flow`
                : `/lessons/${course.id}/flow`
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              navigate(
                pathIdSegment
                  ? `${pathIdSegment}/lessons/${course.id}/flow`
                  : `/lessons/${course.id}/flow`
              );
            }
          }}
          tabIndex={0}
        >
          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[#2a7347]/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
          <div className="relative">
            <div className="flex items-baseline justify-between">
              <h3 className="app-display text-xl text-content-primary">
                {course.title}
              </h3>
              <span className="app-eyebrow group-hover:text-[color:var(--primary-bright,#2a7347)]">
                {t("courses.list.viewLesson")}
              </span>
            </div>
            {course.description && (
              <p className="mt-2 text-sm text-content-muted">
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
