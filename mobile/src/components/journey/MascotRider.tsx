import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { MascotType } from "@garzoni/core";
import { MascotSprite } from "./JourneyScenery";

const MASCOT_SIZE = 78;

type Props = {
  /** Current node center, map coordinates. */
  nodeX: number;
  nodeY: number;
  /** Half-width of the current node (halo included). */
  nodeRadius: number;
  mapWidth: number;
  mascot: MascotType;
  motionSimplify: boolean;
};

/** "You are here" — 3D mascot standing beside the current node. */
export default function MascotRider({
  nodeX,
  nodeY,
  nodeRadius,
  mapWidth,
  mascot,
  motionSimplify,
}: Props) {
  const onLeft = nodeX > mapWidth / 2;
  const gap = nodeRadius + 6;
  const left = onLeft
    ? Math.max(nodeX - gap - MASCOT_SIZE, 4)
    : Math.min(nodeX + gap, mapWidth - MASCOT_SIZE - 4);
  const top = nodeY - MASCOT_SIZE + 14;

  const bob = useSharedValue(0);
  useEffect(() => {
    if (motionSimplify) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [bob, motionSimplify]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <View pointerEvents="none" style={[styles.wrap, { left, top }]}>
      <Animated.View style={motionSimplify ? null : bobStyle}>
        <MascotSprite mascot={mascot} height={MASCOT_SIZE} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 4,
  },
});
