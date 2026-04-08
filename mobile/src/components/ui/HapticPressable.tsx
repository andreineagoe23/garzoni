import { useCallback, type ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

export type HapticStyle = "selection" | "light" | "medium" | "none";

type Props = Omit<PressableProps, "children"> & {
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  haptic?: HapticStyle;
  style?: StyleProp<ViewStyle>;
};

export function useHapticTap(style: HapticStyle = "selection") {
  return useCallback(() => {
    if (style === "none") return;
    void (async () => {
      try {
        if (style === "selection") {
          await Haptics.selectionAsync();
        } else if (style === "light") {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch {
        /* simulator / no haptics */
      }
    })();
  }, [style]);
}

/** Pressable with optional haptic on press-in (mobile-native feel). */
export default function HapticPressable({
  haptic = "selection",
  onPressIn,
  children,
  ...rest
}: Props) {
  const fire = useHapticTap(haptic);

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        fire();
        onPressIn?.(e);
      }}
    >
      {children}
    </Pressable>
  );
}
