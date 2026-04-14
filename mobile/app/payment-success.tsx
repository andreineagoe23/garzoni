import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography } from "../src/theme/tokens";
import { href } from "../src/navigation/href";
import GlassCard from "../src/components/ui/GlassCard";
import ProgressBar from "../src/components/ui/ProgressBar";

const STEPS: { percent: number; messageKey: string }[] = [
  { percent: 25, messageKey: "subscriptions.paymentSuccess.fetchingAnswers" },
  {
    percent: 50,
    messageKey: "subscriptions.paymentSuccess.syncingSubscription",
  },
  { percent: 70, messageKey: "subscriptions.paymentSuccess.buildingPaths" },
  { percent: 100, messageKey: "subscriptions.paymentSuccess.ready" },
];

const STEP_DURATION_MS = 1200;

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function PaymentSuccessScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const params = useLocalSearchParams<{
    session_id?: string | string[];
  }>();
  const sessionId = Platform.OS === "web" ? firstParam(params.session_id) : undefined;

  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !sessionId) {
      router.replace(href("/personalized-path"));
      return;
    }

    const step = STEPS[stepIndex];
    if (!step) {
      router.replace(
        href(
          `/personalized-path?session_id=${encodeURIComponent(sessionId)}&redirect=upgradeComplete`,
        ),
      );
      return;
    }

    setProgress(step.percent);

    if (stepIndex === STEPS.length - 1) {
      const timeout = setTimeout(() => {
        router.replace(
          href(
            `/personalized-path?session_id=${encodeURIComponent(sessionId)}&redirect=upgradeComplete`,
          ),
        );
      }, 800);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => setStepIndex((i) => i + 1),
      STEP_DURATION_MS,
    );
    return () => clearTimeout(timeout);
  }, [sessionId, stepIndex]);

  if (!sessionId) {
    return null;
  }

  const step = STEPS[stepIndex];
  const message = step ? t(step.messageKey as never) : "";

  return (
    <>
      <Stack.Screen
        options={{
          title: t("subscriptions.paymentSuccess.title"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <GlassCard padding="lg" style={styles.card}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: c.primary + "22" },
            ]}
          >
            <MaterialCommunityIcons name="check" size={32} color={c.primary} />
          </View>
          <Text style={[styles.title, { color: c.text }]}>
            {t("subscriptions.paymentSuccess.title")}
          </Text>
          <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
          <ProgressBar
            value={progress / 100}
            height={8}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={[styles.pct, { color: c.textMuted }]}>{progress}%</Text>
        </GlassCard>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  card: { alignItems: "center" },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    fontSize: typography.sm,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 22,
  },
  pct: {
    fontSize: typography.xs,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
