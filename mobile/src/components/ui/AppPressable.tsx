import { forwardRef, useCallback } from "react";
import {
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { safeImpactAsync } from "../../utils/safeHaptics";

/**
 * App-wide Pressable with native press feedback on both platforms.
 *
 * Why this exists: a bare `<Pressable>` gives NO visual feedback unless the call
 * site opts into a `({ pressed })` style function. Across the app most taps had
 * none, so buttons/rows felt dead — most obvious on Android, where users expect
 * a ripple. This wraps Pressable so every adopting call site gets:
 *   - Android: a themed `android_ripple`.
 *   - iOS + Android fallback: `opacity` (or `scale`) dip while pressed.
 *   - optional press-in haptic (opt-in; off by default to avoid over-buzzing).
 *
 * Drop-in for `Pressable`: same props, plus `feedback`, `haptic`, `rippleColor`,
 * `rippleBorderless`. `style` accepts a plain style, an array, or the standard
 * `({ pressed }) => style` function — the press feedback is merged on top.
 */

type Feedback = "opacity" | "scale" | "none";
type HapticStyle = "selection" | "light" | "medium" | "none";

export type AppPressableProps = Omit<PressableProps, "style"> & {
  /** Visual press feedback for iOS (and Android when no ripple). Default "opacity". */
  feedback?: Feedback;
  /** Press-in haptic. Default "none". */
  haptic?: HapticStyle;
  /** Android ripple color. Default a translucent white/neutral. */
  rippleColor?: string;
  /** Borderless (unbounded) ripple — use for icon-only round targets. */
  rippleBorderless?: boolean;
  style?:
    | StyleProp<ViewStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

const OPACITY_PRESSED = 0.6;
const SCALE_PRESSED = 0.97;

async function fireHaptic(style: HapticStyle): Promise<void> {
  if (style === "none") return;
  if (style === "selection") {
    try {
      await Haptics.selectionAsync();
    } catch {
      /* unsupported */
    }
    return;
  }
  await safeImpactAsync(
    style === "light"
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Medium,
  );
}

const AppPressable = forwardRef<View, AppPressableProps>(function AppPressable(
  {
    feedback = "opacity",
    haptic = "none",
    rippleColor,
    rippleBorderless = false,
    disabled,
    onPressIn,
    style,
    children,
    ...rest
  },
  ref,
) {
  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      void fireHaptic(haptic);
      onPressIn?.(e);
    },
    [haptic, onPressIn],
  );

  const android_ripple =
    Platform.OS === "android" && !disabled
      ? {
          color: rippleColor ?? "rgba(255,255,255,0.15)",
          borderless: rippleBorderless,
          foreground: true,
        }
      : undefined;

  // On Android the ripple is the primary feedback, so skip the opacity/scale dip
  // there (double feedback looks off). iOS always uses the visual dip.
  const useVisualDip = feedback !== "none" && Platform.OS === "ios";

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      android_ripple={android_ripple}
      style={(state) => {
        const base =
          typeof style === "function" ? style(state) : style;
        if (!useVisualDip || !state.pressed) return base;
        const dip: ViewStyle =
          feedback === "scale"
            ? { transform: [{ scale: SCALE_PRESSED }] }
            : { opacity: OPACITY_PRESSED };
        return [base, dip];
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
});

export default AppPressable;
