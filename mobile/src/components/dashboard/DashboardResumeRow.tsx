import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ProgressSummary } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";
import type { DashboardWeakSkill } from "../../hooks/useDashboardSkillExercisesNavigation";

type Props = {
  resume?: ProgressSummary["resume"] | null;
  startHere?: ProgressSummary["start_here"] | null;
  style?: StyleProp<ViewStyle>;
  /** Top weak skill — surfaces a secondary "Practice/Review" CTA inline. */
  topWeakSkill?: DashboardWeakSkill | null;
  onTopWeakSkillAction?: (skill: DashboardWeakSkill) => void;
};

/**
 * Mirrors web dashboard tiles: inner stack is column (icon+text, then full-width CTA).
 * Web: `flex-col gap-3 sm:flex-row` — on phone the CTA is full width under the copy.
 */
export default function DashboardResumeRow({
  resume,
  startHere,
  style,
  topWeakSkill,
  onTopWeakSkillAction,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  const renderWeakSkillCta = () => {
    if (!topWeakSkill || !onTopWeakSkillAction) return null;
    const isDue =
      topWeakSkill.recommended_action === "review" &&
      topWeakSkill.review_exercise_id != null;
    const label = isDue
      ? t("dashboard.weakSkills.action.reviewNow")
      : t("dashboard.weakSkills.action.practice");
    return (
      <GlassButton
        variant="secondary"
        size="sm"
        style={styles.ctaWide}
        onPress={() => onTopWeakSkillAction(topWeakSkill)}
      >
        {`${label} · ${topWeakSkill.skill}`}
      </GlassButton>
    );
  };

  if (resume) {
    return (
      <GlassCard
        padding="md"
        style={[styles.card, { borderColor: c.border }, style]}
      >
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={26}
              color={c.primary}
            />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: c.text }]}>
                {t("dashboard.resume.title")}
              </Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                {t("dashboard.resume.continueWith", {
                  course: resume.course_title,
                })}
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
          {renderWeakSkillCta()}
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      padding="md"
      style={[styles.card, { borderColor: c.border }, style]}
    >
      <View style={styles.sheet}>
        <View style={styles.topRow}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={26}
            color={c.primary}
          />
          <View style={styles.copy}>
            {/* No progress yet — "pick up where you left off" is a lie on day one. */}
            <Text style={[styles.title, { color: c.text }]}>
              {t("dashboard.resume.firstTitle")}
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
          {t("dashboard.resume.firstCta")}
        </GlassButton>
        {renderWeakSkillCta()}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
  },
  sheet: {
    gap: spacing.md,
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
  title: {
    fontSize: typography.md,
    fontWeight: "600",
    lineHeight: 22,
  },
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
