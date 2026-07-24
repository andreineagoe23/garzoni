/**
 * FirstWeekChecklist — endowed-progress onboarding checklist (UX plan 2.5).
 *
 * Shown near the top of the dashboard for accounts younger than 7 days:
 *   1. Built your plan          — pre-checked when the questionnaire is complete
 *   2. Complete your first lesson — `first_lesson_at` from the progress summary
 *   3. Try one AI tool          — `has_used_tool` from the progress summary
 *   4. Start your streak        — streak >= 1
 *
 * Account age comes from the profile payload's `user_data.date_joined` (same
 * field useCio.ts reads). If `date_joined` is missing, we fall back to a proxy:
 * treat the user as "new" while their first lesson hasn't happened yet.
 *
 * Dismissal is persisted in localStorage (per user) — dismissed = gone for
 * good, no reappear logic by design. Hidden entirely once all 4 are done.
 */
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import { recordFunnelEvent } from "services/analyticsService";

const ACCOUNT_AGE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

const dismissalKey = (userId: string | number | undefined) =>
  `garzoni.firstWeekChecklist.dismissed.${userId ?? "anon"}`;

export interface FirstWeekChecklistProps {
  /** ISO date the account was created (profile user_data.date_joined). */
  accountCreatedAt?: string | null;
  /** Stable user id for the localStorage dismissal key. */
  userId?: string | number;
  questionnaireCompleted: boolean;
  /** ISO timestamp of the first lesson completion, from the summary payload. */
  firstLessonAt?: string | null;
  /** Whether the user has ever used an AI tool, from the summary payload. */
  hasUsedTool?: boolean;
  streakCount: number;
  /** Navigate to the dashboard's existing start/resume lesson target. */
  onStartLesson: () => void;
  /** Navigate to the AI tools page. */
  onOpenTools: () => void;
}

type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  action?: () => void;
};

const FirstWeekChecklist: React.FC<FirstWeekChecklistProps> = ({
  accountCreatedAt,
  userId,
  questionnaireCompleted,
  firstLessonAt,
  hasUsedTool,
  streakCount,
  onStartLesson,
  onOpenTools,
}) => {
  const { t } = useTranslation();
  const storageKey = dismissalKey(userId);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const firstLessonDone = Boolean(firstLessonAt);
  const toolDone = Boolean(hasUsedTool);
  const streakDone = streakCount >= 1;

  const isNewAccount = useMemo(() => {
    if (accountCreatedAt) {
      const created = new Date(accountCreatedAt).getTime();
      if (Number.isFinite(created)) {
        return Date.now() - created < ACCOUNT_AGE_LIMIT_MS;
      }
    }
    // Proxy when the profile doesn't expose a creation date: a user who hasn't
    // completed their first lesson yet is still in their "first week".
    return !firstLessonDone;
  }, [accountCreatedAt, firstLessonDone]);

  const trackAndGo = (item: string, action: () => void) => {
    Promise.resolve(
      recordFunnelEvent("checklist_item_click", {
        metadata: { item, source: "first_week_checklist" },
      })
    ).catch(() => {});
    action();
  };

  const items: ChecklistItem[] = [
    {
      key: "built_plan",
      label: t("dashboard.firstWeek.items.built_plan"),
      done: questionnaireCompleted,
    },
    {
      key: "first_lesson",
      label: t("dashboard.firstWeek.items.first_lesson"),
      done: firstLessonDone,
      action: () => trackAndGo("first_lesson", onStartLesson),
    },
    {
      key: "try_tool",
      label: t("dashboard.firstWeek.items.try_tool"),
      done: toolDone,
      action: () => trackAndGo("try_tool", onOpenTools),
    },
    {
      key: "start_streak",
      label: t("dashboard.firstWeek.items.start_streak"),
      done: streakDone,
      // A streak starts by completing a lesson — same destination.
      action: () => trackAndGo("start_streak", onStartLesson),
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (dismissed || allDone || !isNewAccount) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures (private mode etc.) — hide for this session.
    }
    setDismissed(true);
  };

  return (
    <div
      className="app-card relative mt-6 min-w-0 p-4 sm:p-5"
      aria-label={t("dashboard.firstWeek.ariaLabel")}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("dashboard.firstWeek.dismiss")}
        className="absolute right-3 top-3 rounded-full p-1 text-content-muted transition hover:bg-black/5 hover:text-content-primary dark:hover:bg-white/10"
      >
        <GarzoniIcon name="xmark" size={16} />
      </button>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-content-primary">
            {t("dashboard.firstWeek.title")}
          </p>
          <p className="text-xs text-content-muted">
            {t("dashboard.firstWeek.progress", {
              done: doneCount,
              total: items.length,
            })}
          </p>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  item.done
                    ? "border-[color:var(--color-brand-primary)] bg-[color:var(--color-brand-primary)] text-white"
                    : "border-[color:var(--color-border-default)] bg-transparent"
                }`}
              >
                {item.done ? <GarzoniIcon name="check" size={12} /> : null}
              </span>
              {item.done || !item.action ? (
                <span
                  className={`text-sm ${
                    item.done
                      ? "text-content-muted line-through"
                      : "text-content-primary"
                  }`}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.action}
                  className="text-left text-sm font-medium text-content-primary underline-offset-2 transition hover:text-[color:var(--color-brand-primary)] hover:underline"
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FirstWeekChecklist;
