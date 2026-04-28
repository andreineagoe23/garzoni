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
  activityCalendarByType?: Record<
    string,
    {
      lessons?: number | string;
      sections?: number | string;
      exercises?: number | string;
      quizzes?: number | string;
    }
  >;
  weekdayLabels: string[];
};

const ActivityCalendar = React.memo(
  ({
    currentMonth,
    activityCalendar,
    activityCalendarByType,
    weekdayLabels,
  }: ActivityCalendarProps) => {
    const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

    if (!currentMonth.first_day || !currentMonth.last_day) return null;

    const firstDay = new Date(currentMonth.first_day as string | number | Date);
    const lastDay = new Date(currentMonth.last_day as string | number | Date);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const selectedByType = selectedDate
      ? activityCalendarByType?.[selectedDate]
      : undefined;
    const toNum = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const selectedDetails = {
      lessons: toNum(selectedByType?.lessons),
      sections: toNum(selectedByType?.sections),
      exercises: toNum(selectedByType?.exercises),
      quizzes: toNum(selectedByType?.quizzes),
    };
    const selectedTotal = selectedDate
      ? toNum(activityCalendar[selectedDate])
      : 0;
    const selectedHasDetails =
      selectedDetails.lessons +
        selectedDetails.sections +
        selectedDetails.exercises +
        selectedDetails.quizzes >
      0;

    return (
      <GlassCard padding="md" className="space-y-4 bg-surface-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-content-primary">
            {currentMonth.month_name} {currentMonth.year}
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-content-muted">
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

            const isSelected = selectedDate === dateStr;
            const monthLabel = String(currentMonth.month_name ?? "").trim();
            const yearLabel =
              currentMonth.year != null ? String(currentMonth.year) : "";
            const dateAria = [monthLabel, yearLabel].filter(Boolean).join(" ");
            const activityLabel =
              activityCount === 1
                ? "1 activity"
                : `${activityCount} activities`;

            return (
              <button
                key={day}
                type="button"
                className="relative flex h-16 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-[color:var(--border-color,#d1d5db)] text-content-primary transition hover:border-[color:var(--accent,#3b82f6)]/50"
                style={{
                  backgroundColor: hasActivity
                    ? "rgba(var(--accent-rgb,59,130,246),0.12)"
                    : "var(--input-bg,rgba(15,23,42,0.04))",
                  boxShadow: hasActivity
                    ? "0 0 0 1px rgba(var(--accent-rgb,59,130,246),0.25)"
                    : "none",
                }}
                aria-pressed={isSelected}
                aria-label={
                  dateAria
                    ? `Day ${day}, ${dateAria}. ${hasActivity ? activityLabel : "No activity"}.`
                    : `Day ${day}. ${hasActivity ? activityLabel : "No activity"}.`
                }
                onClick={() => setSelectedDate(dateStr)}
              >
                <span className="text-sm font-semibold">{day}</span>
                {hasActivity && (
                  <span className="mt-1 rounded-full bg-[color:var(--primary,#1d5330)]/15 px-2 text-xs font-semibold text-[color:var(--accent,#ffd700)]">
                    {activityCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedDate ? (
          <div className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,rgba(15,23,42,0.04))] p-3">
            <p className="text-sm font-semibold text-content-primary">
              {selectedDate}
            </p>
            {selectedHasDetails ? (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-card p-2">
                  <span className="text-content-muted">Lessons</span>
                  <p className="text-sm font-semibold text-content-primary">
                    {selectedDetails.lessons}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-card p-2">
                  <span className="text-content-muted">Sections</span>
                  <p className="text-sm font-semibold text-content-primary">
                    {selectedDetails.sections}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-card p-2">
                  <span className="text-content-muted">Exercises</span>
                  <p className="text-sm font-semibold text-content-primary">
                    {selectedDetails.exercises}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-card p-2">
                  <span className="text-content-muted">Quizzes</span>
                  <p className="text-sm font-semibold text-content-primary">
                    {selectedDetails.quizzes}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-content-muted">
                Total activity: {selectedTotal}
              </p>
            )}
          </div>
        ) : null}
      </GlassCard>
    );
  }
);

ActivityCalendar.displayName = "ActivityCalendar";

export default ActivityCalendar;
