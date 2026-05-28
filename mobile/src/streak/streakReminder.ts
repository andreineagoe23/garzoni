import * as Notifications from "expo-notifications";

const STREAK_REMINDER_ID = "garzoni-streak-reminder";
const STREAK_MIN_TO_PROTECT = 3;
const REMINDER_HOUR_LOCAL = 20; // 8pm device-local

/**
 * Compute the next 8pm device-local. If it's already past 8pm today, schedule
 * for 8pm tomorrow. We never fire immediately — the goal is "don't break your
 * streak before the day is over", which only makes sense before midnight.
 */
function nextReminderDate(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(REMINDER_HOUR_LOCAL, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export async function cancelStreakReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID);
  } catch {
    /* may not be scheduled — safe to ignore */
  }
}

/**
 * Schedule the next streak reminder at the next 8pm device-local. Cancels any
 * existing pending reminder first so callers can invoke this idempotently on
 * every lesson completion or every dashboard mount without leaking duplicates.
 *
 * No-op when streak is below the protection threshold (1- or 2-day streaks
 * are not worth pestering for and risk feeling like nagging on day-1 users).
 */
export async function scheduleStreakReminder(streak: number): Promise<void> {
  if (!Number.isFinite(streak) || streak < STREAK_MIN_TO_PROTECT) {
    await cancelStreakReminder();
    return;
  }
  await cancelStreakReminder();
  const fireAt = nextReminderDate();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_ID,
      content: {
        title: "Don't break your streak 🔥",
        body: `One lesson today keeps your ${streak}-day streak alive.`,
        data: { type: "streak_reminder", streak },
        sound: "default",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  } catch {
    /* scheduling can fail if permissions revoked — silent */
  }
}
