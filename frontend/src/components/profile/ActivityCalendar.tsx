import React from "react";
import { GlassCard } from "components/ui";

type CurrentMonth = {
  first_day?: string | number | Date | null;
  last_day?: string | number | Date | null;
  month_name?: string;
  year?: number | string | null;
};

type ActivityCalendarProps = {
  currentMonth: CurrentMonth;
  activityCalendar: Record<string, unknown>;
  weekdayLabels: string[];
};

const ActivityCalendar = React.memo(
  ({ currentMonth, activityCalendar, weekdayLabels }: ActivityCalendarProps) => {
    if (!currentMonth.first_day || !currentMonth.last_day) return null;

    const firstDay = new Date(currentMonth.first_day as string | number | Date);
    const lastDay = new Date(currentMonth.last_day as string | number | Date);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <GlassCard
        padding="md"
        className="space-y-4 bg-[color:var(--card-bg,#ffffff)]/60"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[color:var(--text-color,#111827)]">
            {currentMonth.month_name} {currentMonth.year}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {weekdayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-sm">
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="h-16 rounded-xl border border-dashed border-[color:var(--border-color,#d1d5db)]"
              aria-hidden="true"
            />
          ))}
          {days.map((day) => {
            const firstDayStr = String(currentMonth.first_day ?? "");
            const [y, m] = firstDayStr.split("-");
            const dateStr = `${y}-${m}-${String(day).padStart(2, "0")}`;
            const activityCount = (activityCalendar[dateStr] as number) ?? 0;
            const hasActivity = activityCount > 0;

            return (
              <div
                key={day}
                className="relative flex h-16 flex-col items-center justify-center rounded-xl border border-[color:var(--border-color,#d1d5db)] text-[color:var(--text-color,#111827)] transition"
                style={{
                  backgroundColor: hasActivity
                    ? "rgba(var(--accent-rgb,59,130,246),0.12)"
                    : "var(--input-bg,rgba(15,23,42,0.04))",
                  boxShadow: hasActivity
                    ? "0 0 0 1px rgba(var(--accent-rgb,59,130,246),0.25)"
                    : "none",
                }}
              >
                <span className="text-sm font-semibold">{day}</span>
                {hasActivity && (
                  <span className="mt-1 rounded-full bg-[color:var(--primary,#1d5330)]/15 px-2 text-xs font-semibold text-[color:var(--accent,#ffd700)]">
                    {activityCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    );
  }
);

export default ActivityCalendar;
