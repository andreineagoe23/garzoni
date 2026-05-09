jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

/* eslint-disable import/first -- mock must run before importing the module under test */
import * as Haptics from "expo-haptics";
import { safeImpactAsync, safeNotificationAsync } from "../safeHaptics";

describe("safeHaptics", () => {
  it("delegates to impactAsync", async () => {
    await safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("delegates to notificationAsync", async () => {
    await safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });
});
