import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";
import { DEMO_STEPS } from "../../../src/types/next-steps";
import type {
  NextStep,
  NextStepsResponse,
} from "../../../src/types/next-steps";
import { SwipeCard } from "../../../src/components/tools/next-steps/SwipeCard";
import { ProgressBar } from "../../../src/components/tools/next-steps/ProgressBar";
import { EmptyState } from "../../../src/components/tools/next-steps/EmptyState";

export default function NextStepsScreen() {
  const c = useThemeColors();
  const [steps, setSteps] = useState<NextStep[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const confettiRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fetchSteps = useCallback(async () => {
    try {
      const res = await (apiClient as any).get("/next-steps/");
      const data: NextStepsResponse = res.data;
      setSteps(data.steps ?? []);
      setCompletedToday(data.completed_today ?? 0);
      setDailyLimit(data.limit ?? 3);
    } catch {
      // Fallback to local demo steps
      setSteps(DEMO_STEPS);
      setCompletedToday(0);
      setDailyLimit(3);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSteps();
  }, [fetchSteps]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchSteps();
  }, [fetchSteps]);

  const animateCardOut = useCallback(
    (cb: () => void) => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(cb, 150);
    },
    [fadeAnim],
  );

  const handleComplete = useCallback(async () => {
    if (steps.length === 0) return;
    const step = steps[0];

    try {
      await (apiClient as any).post(`/next-steps/${step.id}/complete/`);
    } catch {
      // continue regardless
    }

    animateCardOut(() => {
      setSteps((prev) => prev.slice(1));
      setCompletedToday((n) => n + 1);
    });

    confettiRef.current?.start();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [steps, animateCardOut]);

  const handleSkip = useCallback(() => {
    if (steps.length === 0) return;
    animateCardOut(() => {
      setSteps((prev) => [...prev.slice(1), prev[0]]);
    });
  }, [steps, animateCardOut]);

  const isDone = steps.length === 0 || completedToday >= dailyLimit;

  return (
    <>
      <Stack.Screen options={{ title: "Next Steps" }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.heroTitle, { color: c.text }]}>Next Steps</Text>
          <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
            Personalized actions to improve your financial health
          </Text>
        </View>

        <ProgressBar completed={completedToday} total={dailyLimit} />

        {loading ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.loadingText, { color: c.textMuted }]}>
              Loading your steps…
            </Text>
          </View>
        ) : isDone ? (
          <EmptyState />
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            <SwipeCard
              step={steps[0]}
              onComplete={() => {
                void handleComplete();
              }}
              onSkip={handleSkip}
            />
          </Animated.View>
        )}

        {/* Remaining count */}
        {!isDone && steps.length > 1 && (
          <Text style={[styles.remaining, { color: c.textFaint }]}>
            {steps.length - 1} more step{steps.length - 1 !== 1 ? "s" : ""}{" "}
            queued
          </Text>
        )}
      </ScrollView>

      <ConfettiCannon
        ref={confettiRef}
        count={60}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut
        colors={["#ffd700", "#2a6041", "#ffffff", "#f59e0b"]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  headerSection: { gap: spacing.xs },
  heroTitle: {
    fontSize: typography.xxl,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: { fontSize: typography.sm, lineHeight: 20 },
  loadingCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxxxl,
    alignItems: "center",
  },
  loadingText: { fontSize: typography.sm },
  remaining: { textAlign: "center", fontSize: typography.xs },
});
