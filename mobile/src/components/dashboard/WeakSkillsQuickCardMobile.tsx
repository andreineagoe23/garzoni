import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { DashboardWeakSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius, shadows } from "../../theme/tokens";

function formatPct(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.min(100, Math.max(0, n)) / 100);
}

type Props = {
  locale?: string;
  topSkill?: DashboardWeakSkill | null;
  onRecommendedSkillExercises?: (skill: DashboardWeakSkill) => void;
  onOpenExercises?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Same structure as resume tile: icon + copy (full width), then full-width Practice CTA.
 * Weak-skill state uses the richer stacked lines (lead + skill name + %) like the pre-refactor mobile card.
 */
export default function WeakSkillsQuickCardMobile({
  locale,
  topSkill,
  onRecommendedSkillExercises,
  onOpenExercises,
  style,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const hasSkill = Boolean(topSkill?.skill);
  const buttonDisabled = hasSkill && !onRecommendedSkillExercises;
  const borderTint = c.primary + "66";
  const fill = c.primary + "12";

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
      <View style={[styles.sheet, { backgroundColor: fill }]}>
        <View style={styles.topRow}>
          <MaterialCommunityIcons
            name="lightbulb-on-outline"
            size={26}
            color={c.primary}
          />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: c.text }]}>
              {t("dashboard.weakSkills.quickPracticeTitle")}
            </Text>
            {hasSkill && topSkill ? (
              <View style={styles.skillBlock}>
                <Text style={[styles.body, { color: c.textMuted }]}>
                  {t("dashboard.weakSkills.lowMasteryLead")}
                </Text>
                <Text
                  style={[styles.skillName, { color: c.text }]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {topSkill.skill}
                </Text>
                <Text style={[styles.pct, { color: c.primary }]}>
                  {formatPct(topSkill.proficiency, locale)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.body, { color: c.textMuted }]}>
                {t("dashboard.weakSkills.quickPracticeSubtitle")}
              </Text>
            )}
          </View>
        </View>
        <GlassButton
          variant="primary"
          size="sm"
          style={styles.ctaWide}
          disabled={buttonDisabled}
          onPress={() => {
            if (hasSkill && topSkill && onRecommendedSkillExercises) {
              onRecommendedSkillExercises(topSkill);
            } else {
              onOpenExercises?.();
            }
          }}
        >
          {t("dashboard.weakSkills.practice")}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
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
  skillBlock: {
    marginTop: 2,
    gap: 4,
  },
  skillName: {
    fontSize: typography.sm,
    fontWeight: "700",
    lineHeight: 18,
  },
  pct: {
    fontSize: typography.xs,
    fontWeight: "800",
    marginTop: 2,
  },
  ctaWide: {
    alignSelf: "stretch",
    marginTop: 0,
  },
});
