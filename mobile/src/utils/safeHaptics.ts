import * as Device from "expo-device";
import * as Haptics from "expo-haptics";

/** Skips on simulator to avoid native haptic noise; keyboard haptics are still a Simulator quirk. */
export async function safeImpactAsync(
  style: Haptics.ImpactFeedbackStyle,
): Promise<void> {
  if (!Device.isDevice) return;
  try {
    await Haptics.impactAsync(style);
  } catch {
    /* unsupported */
  }
}

export async function safeNotificationAsync(
  type: Haptics.NotificationFeedbackType,
): Promise<void> {
  if (!Device.isDevice) return;
  try {
    await Haptics.notificationAsync(type);
  } catch {
    /* unsupported */
  }
}
