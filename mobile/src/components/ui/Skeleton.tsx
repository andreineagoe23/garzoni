import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius } from "../../theme/tokens";

type SkeletonProps = {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export default function Skeleton({
  width,
  height,
  borderRadius = radius.md,
  style,
}: SkeletonProps) {
  const c = useThemeColors();
  const opacity = useRef(new Animated.Value(0.35)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: { backgroundColor: c.surfaceOffset },
      }),
    [c],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as number, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}
