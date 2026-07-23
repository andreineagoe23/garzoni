import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidNotificationChannels } from "../bootstrap/pushNotificationsMobile";

const STREAK_REMINDER_PREFIX = "garzoni-streak-reminder";
/** Legacy single-shot identifier from before the rolling window; still cancelled. */
const LEGACY_REMINDER_ID = "garzoni-streak-reminder";
const STREAK_MIN_TO_PROTECT = 3;
const REMINDER_HOUR_LOCAL = 20; // 8pm device-local

/**
 * How many days ahead to schedule.
 *
 * The previous version scheduled exactly one reminder and only re-armed it when
 * the dashboard mounted — so a user who stopped opening the app got one final
 * nudge and then silence, which is precisely the user a streak reminder exists
 * for. A rolling window keeps nudging without needing the app (or the server)
 * to run again.
 */
const REMINDER_DAYS = 7;

function reminderId(dayOffset: number): string {
  return `${STREAK_REMINDER_PREFIX}-${dayOffset}`;
}

/**
 * Next occurrence of 8pm device-local, `dayOffset` days out. Never fires
 * immediately — "don't break your streak" only makes sense before midnight.
 */
function reminderDate(dayOffset: number): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(REMINDER_HOUR_LOCAL, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  target.setDate(target.getDate() + dayOffset);
  return target;
}

/**
 * Copy escalates with each missed day. Day 0 protects the streak; later days
 * acknowledge it is gone and pivot to restarting, because pretending an
 * already-broken streak is still alive reads as spam.
 */
function reminderContent(
  streak: number,
  dayOffset: number,
): { title: string; body: string } {
  if (dayOffset === 0) {
    return {
      title: "Don't break your streak 🔥",
      body: `One lesson today keeps your ${streak}-day streak alive.`,
    };
  }
  if (dayOffset === 1) {
    return {
      title: "Your streak is slipping",
      body: `Five minutes now and your ${streak}-day streak survives the week.`,
    };
  }
  if (dayOffset <= 3) {
    return {
      title: "Pick up where you left off",
      body: "One short lesson is enough to get moving again.",
    };
  }
  return {
    title: "Ready for a fresh start?",
    body: `You built a ${streak}-day streak once. Start the next one today.`,
  };
}

export async function cancelStreakReminder(): Promise<void> {
  const ids = [
    LEGACY_REMINDER_ID,
    ...Array.from({ length: REMINDER_DAYS }, (_, i) => reminderId(i)),
  ];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* may not be scheduled — safe to ignore */
    }
  }
}

/**
 * Schedule a rolling window of evening reminders, one per day for the next
 * {@link REMINDER_DAYS} days. Cancels the previous window first, so callers can
 * invoke this on every lesson completion or dashboard mount without leaking
 * duplicates — each app open simply pushes the window forward.
 *
 * No-op when the streak is below the protection threshold: 1- and 2-day streaks
 * are not worth pestering for and read as nagging to a day-one user.
 */
export async function scheduleStreakReminder(streak: number): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelStreakReminder();
  if (!Number.isFinite(streak) || streak < STREAK_MIN_TO_PROTECT) return;

  // A revoked permission makes every schedule call throw; check once instead of
  // failing REMINDER_DAYS times.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
  } catch {
    return;
  }

  // These are posted to the "streak" channel below. Android silently drops a
  // notification whose channel does not exist, and channel creation otherwise
  // only happens inside registerForPushAndSubmitToken — which is behind a 24h
  // re-registration gate, so a daily user upgrading to this build would have no
  // "streak" channel and no reminders at all.
  await ensureAndroidNotificationChannels();

  for (let dayOffset = 0; dayOffset < REMINDER_DAYS; dayOffset++) {
    const { title, body } = reminderContent(streak, dayOffset);
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: reminderId(dayOffset),
        content: {
          title,
          body,
          data: { type: "streak_reminder", streak, deeplink: "/(tabs)/learn" },
          sound: "default",
          ...(Platform.OS === "android" ? { channelId: "streak" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate(dayOffset),
        },
      });
    } catch {
      /* scheduling can fail per-day (quota, permissions) — keep the rest */
    }
  }
}
