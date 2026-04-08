import * as Haptics from "expo-haptics";

/** Haptics with errors swallowed (simulator / missing native support). */
export async function safeImpactAsync(
  style: Haptics.ImpactFeedbackStyle,
): Promise<void> {
  try {
    await Haptics.impactAsync(style);
  } catch {
    /* unsupported */
  }
}

export async function safeNotificationAsync(
  type: Haptics.NotificationFeedbackType,
): Promise<void> {
  try {
    await Haptics.notificationAsync(type);
  } catch {
    /* unsupported */
  }
}
