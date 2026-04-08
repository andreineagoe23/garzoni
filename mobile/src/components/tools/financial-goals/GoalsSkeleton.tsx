import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, spacing } from "../../../theme/tokens";

function PulseBlock({
  width,
  height,
}: {
  width: number | `${number}%`;
  height: number;
}) {
  const c = useThemeColors();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
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
        {
          width,
          height,
          borderRadius: radius.md,
          backgroundColor: c.border,
          opacity,
        },
      ]}
    />
  );
}

export function GoalsSkeleton() {
  const c = useThemeColors();
  return (
    <View style={styles.stack}>
      {[0, 1].map((k) => (
        <View
          key={k}
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.row}>
            <PulseBlock width={"55%"} height={18} />
            <PulseBlock width={72} height={24} />
          </View>
          <PulseBlock width={"100%"} height={12} />
          <PulseBlock width={"70%"} height={12} />
          <PulseBlock width={"100%"} height={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
});
