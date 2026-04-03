import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchQuestionnaireProgress, i18n, queryKeys } from "@monevo/core";
import { href } from "../../navigation/href";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import ProgressBar from "../ui/ProgressBar";
import { spacing, typography } from "../../theme/tokens";

export default function QuestionnaireReminderBanner() {
  const c = useThemeColors();

  const q = useQuery({
    queryKey: queryKeys.questionnaireProgress(),
    queryFn: fetchQuestionnaireProgress,
    staleTime: 0,
    refetchOnMount: true,
  });

  if (q.isPending && !q.data) {
    return (
      <GlassCard padding="md" style={{ borderColor: c.primary }}>
        <Text style={{ color: c.textMuted }}>
          {i18n.t("onboarding.reminderBanner.loading")}
        </Text>
      </GlassCard>
    );
  }

  if (q.isError) {
    return (
      <GlassCard padding="md" style={{ borderColor: c.primary }}>
        <Text style={{ color: c.textMuted, marginBottom: spacing.sm }}>
          {i18n.t("onboarding.reminderBanner.error")}
        </Text>
        <GlassButton variant="primary" size="sm" onPress={() => void q.refetch()}>
          {i18n.t("onboarding.reminderBanner.tryAgain")}
        </GlassButton>
      </GlassCard>
    );
  }

  const progress = q.data;
  if (!progress || progress.status === "completed") {
    return null;
  }

  const completedSections = progress.completed_sections_count ?? 0;
  const totalSections = Math.max(1, progress.total_sections ?? 0);
  const totalQuestions = progress.total_questions ?? 0;
  const currentQuestionNumber = progress.current_question_number ?? 0;
  const pct = Math.min(1, Math.max(0, (progress.progress_percentage ?? 0) / 100));

  const primaryCtaLabel =
    completedSections > 0
      ? i18n.t("onboarding.reminderBanner.resume")
      : i18n.t("onboarding.reminderBanner.start");

  const detail =
    totalQuestions > 0
      ? i18n.t("onboarding.reminderBanner.questionsComplete", {
          done: Math.max(currentQuestionNumber - 1, 0),
          total: totalQuestions,
          percent: progress.progress_percentage ?? 0,
        })
      : i18n.t("onboarding.reminderBanner.sectionsComplete", {
          done: completedSections,
          total: totalSections,
          percent: progress.progress_percentage ?? 0,
        });

  return (
    <GlassCard padding="md" style={{ borderColor: c.primary, backgroundColor: c.accentMuted }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.h, { color: c.text }]}>
            {i18n.t("onboarding.reminderBanner.status")}
          </Text>
          <Text style={[styles.p, { color: c.textMuted }]}>{detail}</Text>
          <ProgressBar value={pct} color={c.primary} style={{ marginTop: spacing.sm }} />
        </View>
        <GlassButton
          variant="primary"
          size="sm"
          onPress={() => router.push(href("/onboarding"))}
        >
          {primaryCtaLabel}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "column", gap: spacing.md },
  h: { fontSize: typography.sm, fontWeight: "800" },
  p: { fontSize: typography.xs, marginTop: 4, lineHeight: 18 },
});
