jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("../../bootstrap/pushNotificationsMobile", () => ({
  ensureAndroidNotificationChannels: jest.fn(() => Promise.resolve()),
}));

jest.mock("@garzoni/core", () => ({
  i18n: { t: jest.fn((key: string) => key) },
}));

/* eslint-disable import/first -- mocks must run before importing the module under test */
import * as Notifications from "expo-notifications";
import { i18n } from "@garzoni/core";
import { scheduleStreakReminder } from "../streakReminder";

const scheduled = Notifications.scheduleNotificationAsync as jest.Mock;
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const translate = i18n.t as unknown as jest.Mock;

/** Every translation key the module asked for, across all scheduled days. */
function requestedKeys(): string[] {
  return translate.mock.calls.map((c) => String(c[0]));
}

describe("scheduleStreakReminder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissions.mockResolvedValue({ status: "granted" });
  });

  it("arms the window from the very first day", async () => {
    // Regression guard: this floor used to be 3, so the reminder required the
    // streak it exists to produce and never armed for anyone.
    await scheduleStreakReminder(1);
    expect(scheduled).toHaveBeenCalled();
  });

  it("schedules a rolling window rather than a single reminder", async () => {
    await scheduleStreakReminder(1);
    expect(scheduled.mock.calls.length).toBeGreaterThan(1);
  });

  it("does nothing when there is no streak at all", async () => {
    await scheduleStreakReminder(0);
    expect(scheduled).not.toHaveBeenCalled();
  });

  it("does nothing when the streak is not a finite number", async () => {
    await scheduleStreakReminder(Number.NaN);
    expect(scheduled).not.toHaveBeenCalled();
  });

  it("does nothing when notification permission was revoked", async () => {
    permissions.mockResolvedValue({ status: "denied" });
    await scheduleStreakReminder(5);
    expect(scheduled).not.toHaveBeenCalled();
  });

  it("uses habit-building copy below an established streak", async () => {
    await scheduleStreakReminder(2);
    const keys = requestedKeys();
    expect(keys.some((k) => k.includes(".new."))).toBe(true);
    expect(keys.some((k) => k.includes(".established."))).toBe(false);
  });

  it("uses streak-defending copy once the streak is established", async () => {
    await scheduleStreakReminder(3);
    const keys = requestedKeys();
    expect(keys.some((k) => k.includes(".established."))).toBe(true);
    expect(keys.some((k) => k.includes(".new."))).toBe(false);
  });

  it("escalates copy across the window instead of repeating day 0", async () => {
    await scheduleStreakReminder(5);
    const keys = requestedKeys();
    expect(keys.some((k) => k.endsWith("day0.title"))).toBe(true);
    expect(keys.some((k) => k.endsWith("day1.title"))).toBe(true);
    expect(keys.some((k) => k.endsWith("soon.title"))).toBe(true);
    expect(keys.some((k) => k.endsWith("later.title"))).toBe(true);
  });

  it("never schedules a reminder in the past", async () => {
    await scheduleStreakReminder(5);
    const now = Date.now();
    for (const [arg] of scheduled.mock.calls) {
      expect(arg.trigger.date.getTime()).toBeGreaterThan(now);
    }
  });
});
