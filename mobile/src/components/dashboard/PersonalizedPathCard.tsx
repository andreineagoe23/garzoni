import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { ProgressSummary } from "@monevo/core";
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
  if (resume) {
    return (
      <GlassCard padding="lg" style={{ borderColor: c.primary, backgroundColor: c.primary + "18" }}>
        <Text style={[styles.kicker, { color: c.textOnPrimary }]}>Continue</Text>
        <Text style={[styles.title, { color: c.text }]}>{resume.course_title}</Text>
        <View style={{ marginTop: spacing.md }}>
          <GlassButton
            variant="active"
            size="md"
            onPress={() => router.push(`/flow/${resume.course_id}`)}
          >
            Resume course
          </GlassButton>
        </View>
      </GlassCard>
    );
  }
  if (startHere?.course_id) {
    return (
      <GlassCard padding="lg">
        <Text style={[styles.kicker, { color: c.textMuted }]}>Personalized path</Text>
        <Text style={[styles.title, { color: c.text }]}>
          Start your first tailored learning journey
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <GlassButton
            variant="active"
            size="md"
            onPress={() => router.push(`/flow/${startHere.course_id}`)}
          >
            Begin
          </GlassButton>
        </View>
      </GlassCard>
    );
  }
  return (
    <GlassCard padding="md">
      <Text style={[styles.title, { color: c.text }]}>Explore all topics</Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Pick a learning path below or browse the Learn tab.
      </Text>
      <View style={{ marginTop: spacing.md }}>
        <GlassButton variant="primary" size="md" onPress={() => router.push("/(tabs)/learn")}>
          Browse paths
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: { fontSize: typography.lg, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
});
