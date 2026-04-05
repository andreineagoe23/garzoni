import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ProgressSummary } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius, shadows } from "../../theme/tokens";

type Props = {
  resume?: ProgressSummary["resume"] | null;
  startHere?: ProgressSummary["start_here"] | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Mirrors web dashboard tiles: inner stack is column (icon+text, then full-width CTA).
 * Web: `flex-col gap-3 sm:flex-row` — on phone the CTA is full width under the copy.
 */
export default function DashboardResumeRow({ resume, startHere, style }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  const borderTint = c.primary + "66";
  const fillResume = c.primary + "18";
  const fillEmpty = c.primary + "12";

  if (resume) {
    return (
      <GlassCard
        padding="md"
        fillContent
        intensity={32}
        style={[
          styles.card,
          { borderColor: borderTint },
          shadows.md,
          { shadowColor: c.primary + "44" },
          style,
        ]}
      >
        <View style={[styles.sheet, { backgroundColor: fillResume }]}>
          <View style={styles.topRow}>
            <MaterialCommunityIcons name="book-open-variant" size={26} color={c.primary} />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: c.text }]}>
                {t("dashboard.resume.title")}
              </Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                {t("dashboard.resume.continueWith", { course: resume.course_title })}
              </Text>
            </View>
          </View>
          <GlassButton
            variant="active"
            size="sm"
            style={styles.ctaWide}
            onPress={() => router.push(`/flow/${resume.course_id}`)}
          >
            {t("dashboard.resume.continueLesson")}
          </GlassButton>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      padding="md"
      fillContent
      intensity={32}
      style={[
        styles.card,
        { borderColor: borderTint },
        shadows.md,
        { shadowColor: c.primary + "44" },
        style,
      ]}
    >
      <View style={[styles.sheet, { backgroundColor: fillEmpty }]}>
        <View style={styles.topRow}>
          <MaterialCommunityIcons name="book-open-variant" size={26} color={c.primary} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: c.text }]}>
              {t("dashboard.resume.title")}
            </Text>
            <Text style={[styles.body, { color: c.textMuted }]}>
              {t("dashboard.resume.startFirstLesson")}
            </Text>
          </View>
        </View>
        <GlassButton
          variant="active"
          size="sm"
          style={styles.ctaWide}
          onPress={() => {
            if (startHere?.course_id != null) {
              router.push(`/flow/${startHere.course_id}`);
            } else {
              router.push("/(tabs)/learn");
            }
          }}
        >
          {t("dashboard.resume.browseTopics")}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  /** `flex: 1` comes from parent `resumeCardFill` when tiles are side-by-side. */
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    minHeight: 168,
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
  },
  sheet: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  /** Web: `text-sm font-semibold sm:text-base` */
  title: {
    fontSize: typography.md,
    fontWeight: "600",
    lineHeight: 22,
  },
  /** Slightly larger than web 11px for RN readability at full width */
  body: {
    fontSize: typography.sm,
    lineHeight: 18,
    fontWeight: "400",
  },
  ctaWide: {
    alignSelf: "stretch",
    marginTop: 0,
  },
});
