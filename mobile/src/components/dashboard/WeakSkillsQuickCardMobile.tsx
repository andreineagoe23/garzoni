import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { DashboardWeakSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";

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

  return (
    <GlassCard
      padding="md"
      fillContent
      style={[styles.card, { borderColor: c.primary + "99" }, style]}
    >
      <View style={styles.column}>
        <View style={styles.body}>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={c.primary} />
            <View style={styles.copy}>
              <Text style={[styles.heading, { color: c.text }]} numberOfLines={2}>
                {t("dashboard.weakSkills.quickPracticeTitle")}
              </Text>
              {hasSkill && topSkill ? (
                <View style={styles.skillBlock}>
                  <Text style={[styles.detail, { color: c.textMuted }]} numberOfLines={1}>
                    {t("dashboard.weakSkills.lowMasteryLead")}
                  </Text>
                  <Text
                    style={[styles.skillName, { color: c.text }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {topSkill.skill}
                  </Text>
                  <Text style={[styles.pct, { color: c.primary }]} numberOfLines={1}>
                    {formatPct(topSkill.proficiency, locale)}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.detail, { color: c.textMuted }]}
                  numberOfLines={4}
                  ellipsizeMode="tail"
                >
                  {t("dashboard.weakSkills.quickPracticeSubtitle")}
                </Text>
              )}
            </View>
          </View>
        </View>
        <GlassButton
          variant="primary"
          size="sm"
          style={styles.cta}
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
    flex: 1,
    minHeight: 168,
  },
  column: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 120,
  },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  heading: {
    fontSize: typography.sm,
    fontWeight: "800",
    lineHeight: 18,
  },
  detail: {
    fontSize: typography.xs,
    lineHeight: 18,
  },
  skillBlock: {
    gap: 2,
    marginTop: 2,
  },
  skillName: {
    fontSize: typography.sm,
    fontWeight: "700",
    lineHeight: 20,
  },
  pct: {
    fontSize: typography.xs,
    fontWeight: "800",
    marginTop: 2,
  },
  cta: { alignSelf: "stretch", marginTop: spacing.md },
});
