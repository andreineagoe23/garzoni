import React, { useRef } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../../types/next-steps";
import type { NextStep } from "../../../types/next-steps";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

type Props = {
  step: NextStep;
  onComplete: () => void;
  onSkip: () => void;
};

export function SwipeCard({ step, onComplete, onSkip }: Props) {
  const c = useThemeColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const completeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const skipOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH * 1.5,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onComplete());
        } else if (g.dx < -SWIPE_THRESHOLD) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH * 1.5,
            duration: 250,
            useNativeDriver: true,
          }).start(() => onSkip());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  const categoryColor = CATEGORY_COLORS[step.category];

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        shadows.lg,
        { transform: [{ translateX }, { rotate }] },
      ]}
    >
      {/* Swipe indicators */}
      <Animated.View
        style={[
          styles.swipeHint,
          styles.completeHint,
          { opacity: completeOpacity },
        ]}
      >
        <Text style={styles.hintText}>✓ Done</Text>
      </Animated.View>
      <Animated.View
        style={[styles.swipeHint, styles.skipHint, { opacity: skipOpacity }]}
      >
        <Text style={styles.hintText}>Skip →</Text>
      </Animated.View>

      {/* Category badge */}
      <View
        style={[
          styles.categoryBadge,
          { backgroundColor: categoryColor + "20" },
        ]}
      >
        <Text style={[styles.categoryLabel, { color: categoryColor }]}>
          {CATEGORY_LABELS[step.category]}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>{step.title}</Text>
        <Text style={[styles.description, { color: c.textMuted }]}>
          {step.description}
        </Text>
      </View>

      {/* XP badge */}
      <View style={[styles.xpBadge, { backgroundColor: c.accentMuted }]}>
        <Text style={[styles.xpText, { color: c.accent }]}>+{step.xp} XP</Text>
      </View>

      {/* Swipe hints */}
      <View style={styles.swipeGuide}>
        <Text style={[styles.guideText, { color: c.textFaint }]}>← Skip</Text>
        <Text style={[styles.guideText, { color: c.textFaint }]}>
          Complete →
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    minHeight: 240,
    justifyContent: "space-between",
  },
  swipeHint: {
    position: "absolute",
    top: spacing.lg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  completeHint: {
    right: spacing.lg,
    backgroundColor: "rgba(46,125,50,0.15)",
  },
  skipHint: {
    left: spacing.lg,
    backgroundColor: "rgba(107,114,128,0.15)",
  },
  hintText: { fontSize: typography.sm, fontWeight: "700" },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: { gap: spacing.sm, flex: 1 },
  title: { fontSize: typography.lg, fontWeight: "700", lineHeight: 24 },
  description: { fontSize: typography.sm, lineHeight: 20 },
  xpBadge: {
    alignSelf: "flex-end",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  xpText: { fontSize: typography.xs, fontWeight: "800" },
  swipeGuide: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  guideText: { fontSize: typography.xs },
});
