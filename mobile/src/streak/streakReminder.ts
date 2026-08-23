import { i18n } from "@garzoni/core";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensureAndroidNotificationChannels } from "../bootstrap/pushNotificationsMobile";

const STREAK_REMINDER_PREFIX = "garzoni-streak-reminder";
/** Legacy single-shot identifier from before the rolling window; still cancelled. */
const LEGACY_REMINDER_ID = "garzoni-streak-reminder";
/**
 * Arm from the very first completed day. This was 3, which meant the reminder
 * required the streak it exists to produce — a day-one user, i.e. every user,
 * got nothing, and nobody ever reached day 3 to unlock it.
 */
const STREAK_MIN_TO_ARM = 1;
/** Above this, there is a number worth defending and the copy says so. */
const STREAK_ESTABLISHED = 3;
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
 * Copy escalates with each missed day, and splits on whether there is a streak
 * worth defending yet. Below {@link STREAK_ESTABLISHED} the number is not the
 * hook — "your 1-day streak" reads as a nag about nothing — so the message is
 * about starting the habit instead. From day 2 onward both branches accept the
 * streak is gone and pivot to restarting, because pretending an already-broken
 * streak is still alive reads as spam.
 */
function reminderContent(
  streak: number,
  dayOffset: number,
): { title: string; body: string } {
  const scope = streak >= STREAK_ESTABLISHED ? "established" : "new";
  const bucket =
    dayOffset === 0
      ? "day0"
      : dayOffset === 1
        ? "day1"
        : dayOffset <= 3
          ? "soon"
          : "later";
  const vars = { count: streak, next: streak + 1 };
  return {
    title: i18n.t(`mobile.streakReminder.${scope}.${bucket}.title`, vars),
    body: i18n.t(`mobile.streakReminder.${scope}.${bucket}.body`, vars),
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
 * No-op only when there is no streak at all — a user who has completed nothing
 * has nothing to be reminded about. Everyone from day one onward gets the
 * window; {@link reminderContent} adjusts the tone to how much is at stake.
 */
export async function scheduleStreakReminder(streak: number): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelStreakReminder();
  if (!Number.isFinite(streak) || streak < STREAK_MIN_TO_ARM) return;

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
