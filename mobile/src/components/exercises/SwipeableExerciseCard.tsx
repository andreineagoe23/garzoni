import { useMemo, type ReactNode } from "react";
import { PanResponder, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius } from "../../theme/tokens";

type Props = {
  children: ReactNode;
  onStart: () => void;
  onSkipNext: () => void;
};

/**
 * Horizontal swipe actions without react-native-gesture-handler so the list works
 * when the native RNGH binary is missing or out of sync (rebuild with `expo run:ios`).
 * Swipe left → start, swipe right → next (same as previous Swipeable mapping).
 */
export default function SwipeableExerciseCard({
  children,
  onStart,
  onSkipNext,
}: Props) {
  const c = useThemeColors();

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.15,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -48) onStart();
          else if (g.dx > 48) onSkipNext();
        },
      }),
    [onStart, onSkipNext],
  );

  return (
    <View {...panResponder.panHandlers}>
      <View style={{ backgroundColor: c.bg, borderRadius: radius.md }}>
        {children}
      </View>
    </View>
  );
}
