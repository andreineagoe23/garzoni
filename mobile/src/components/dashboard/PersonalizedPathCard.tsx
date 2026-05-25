import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ProgressSummary } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  resume?: ProgressSummary["resume"];
  startHere?: ProgressSummary["start_here"];
};

export default function PersonalizedPathCard({ resume, startHere }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");

  if (resume) {
    return (
      <GlassCard
        padding="lg"
        style={{ borderColor: c.primary, backgroundColor: c.primary + "18" }}
      >
        <Text style={[styles.kicker, { color: c.textOnPrimary }]}>
          {t("dashboard.pathCard.continue")}
        </Text>
        <Text style={[styles.title, { color: c.text }]}>
          {resume.course_title}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <GlassButton
            variant="active"
            size="md"
            onPress={() => router.push(`/flow/${resume.course_id}`)}
          >
            {t("dashboard.pathCard.resumeCourse")}
          </GlassButton>
        </View>
      </GlassCard>
    );
  }
  if (startHere?.course_id) {
    return (
      <GlassCard padding="lg">
        <Text style={[styles.kicker, { color: c.textMuted }]}>
          {t("dashboard.pathCard.personalizedPath")}
        </Text>
        <Text style={[styles.title, { color: c.text }]}>
          {t("dashboard.pathCard.startJourney")}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <GlassButton
            variant="active"
            size="md"
            onPress={() => router.push(`/flow/${startHere.course_id}`)}
          >
            {t("dashboard.pathCard.begin")}
          </GlassButton>
        </View>
      </GlassCard>
    );
  }
  return (
    <GlassCard padding="md">
      <Text style={[styles.title, { color: c.text }]}>
        {t("dashboard.pathCard.exploreTopics")}
      </Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        {t("dashboard.pathCard.pickPathHint")}
      </Text>
      <View style={{ marginTop: spacing.md }}>
        <GlassButton
          variant="primary"
          size="md"
          onPress={() => router.push("/(tabs)/learn")}
        >
          {t("dashboard.pathCard.browsePaths")}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  title: { fontSize: typography.lg, fontWeight: "700" },
  sub: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
});
