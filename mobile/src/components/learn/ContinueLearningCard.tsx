import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ProgressSummary } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassButton from "../ui/GlassButton";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  resume?: ProgressSummary["resume"] | null;
};

/** Sticky-style resume CTA for the Learn tab (same data as dashboard resume). */
export default function ContinueLearningCard({ resume }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  if (!resume?.course_id) return null;

  return (
    <GlassCard
      padding="md"
      style={[
        styles.card,
        {
          borderColor: c.primary,
          backgroundColor: `${c.primary}18`,
          marginBottom: spacing.lg,
        },
      ]}
    >
      <View style={styles.row}>
        <MaterialCommunityIcons
          name="play-circle"
          size={28}
          color={c.primary}
        />
        <View style={styles.copy}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.resume.title")}
          </Text>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {resume.course_title ?? t("dashboard.resume.continueLesson")}
          </Text>
        </View>
      </View>
      <GlassButton
        variant="active"
        size="sm"
        style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}
        onPress={() => router.push(`/flow/${resume.course_id}`)}
      >
        {t("dashboard.resume.continueLesson")}
      </GlassButton>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: { fontSize: typography.base, fontWeight: "700", marginTop: 2 },
});
