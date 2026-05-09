import { useMemo, useRef } from "react";
import { Animated, Keyboard, PanResponder } from "react-native";

export type BottomSheetVerticalHandleParams = {
  translateY: Animated.Value;
  /** Smallest translateY (sheet most expanded). */
  yExpanded: number;
  /** Default resting translateY when opened (e.g. partial snap). */
  yCollapsed: number;
  /** Fully hidden (usually `SCREEN_HEIGHT`). */
  yHidden: number;
  screenHeight: number;
  /** Called after dismiss animation finishes — typically `onClose`. */
  onDismiss: () => void;
  /** Short tap on handle — e.g. spring to full expansion. */
  onTapExpand: () => void;
  /**
   * How far past `yCollapsed` (downward drag) before dismiss, as a fraction of screen height.
   * Default matches Portfolio Add Holding tuning (~26%).
   */
  dismissDragFraction?: number;
};

/**
 * Pan responder for the **top handle strip** of a bottom sheet: vertical drag to resize /
 * dismiss; tap to expand. Attach with `{...panHandlers}` on a dedicated handle `View` above
 * your `ScrollView` (not on the scroll surface — avoids fighting vertical scroll).
 */
export function useBottomSheetVerticalHandle({
  translateY,
  yExpanded,
  yCollapsed,
  yHidden,
  screenHeight,
  onDismiss,
  onTapExpand,
  dismissDragFraction = 0.26,
}: BottomSheetVerticalHandleParams) {
  const gestureStartYRef = useRef(yCollapsed);
  const lastTranslateYRef = useRef(yCollapsed);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > Math.abs(gs.dx) && Math.abs(gs.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          translateY.stopAnimation((value) => {
            gestureStartYRef.current = value;
            lastTranslateYRef.current = value;
          });
        },
        onPanResponderMove: (_, gs) => {
          const raw = gestureStartYRef.current + gs.dy;
          const clamped = Math.min(yHidden, Math.max(yExpanded, raw));
          lastTranslateYRef.current = clamped;
          translateY.setValue(clamped);
        },
        onPanResponderRelease: (_, gs) => {
          const y = lastTranslateYRef.current;
          const tap =
            Math.abs(gs.dy) < 12 &&
            Math.abs(gs.dx) < 12 &&
            Math.abs(gs.vy) < 0.25;

          if (tap) {
            onTapExpand();
            return;
          }

          const dismissThreshold =
            yCollapsed + screenHeight * dismissDragFraction;
          const dismissByPosition = y > dismissThreshold;
          const dismissByFling = gs.vy > 1.15 && gs.dy > 48;

          if (dismissByPosition || dismissByFling) {
            Animated.timing(translateY, {
              toValue: yHidden,
              duration: 240,
              useNativeDriver: true,
            }).start(() => {
              onDismiss();
            });
            return;
          }

          const mid = (yExpanded + yCollapsed) / 2;
          const snapTo = y < mid ? yExpanded : yCollapsed;
          Animated.spring(translateY, {
            toValue: snapTo,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        },
      }),
    [
      translateY,
      yExpanded,
      yCollapsed,
      yHidden,
      screenHeight,
      onDismiss,
      onTapExpand,
      dismissDragFraction,
    ],
  );

  return { panHandlers: panResponder.panHandlers };
}
