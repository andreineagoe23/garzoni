import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { DashboardWeakSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";
import ErrorState from "../ui/ErrorState";

const JUST_UNLOCKED_THRESHOLD = 20;

function formatPct(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.min(100, Math.max(0, n)) / 100);
}

type Props = {
  show?: boolean;
  masteryError?: unknown;
  weakestSkills?: DashboardWeakSkill[];
  hasAnyMasteryData?: boolean;
  refetchMastery?: () => void;
  locale?: string;
  onSkillClick?: (skill: DashboardWeakSkill) => void;
  onPracticeClick?: (skill: DashboardWeakSkill) => void;
  completedSections?: number;
  totalSections?: number;
  completedLessons?: number;
  totalLessons?: number;
};

export default function WeakSkillsSectionMobile({
  show = true,
  masteryError,
  weakestSkills = [],
  hasAnyMasteryData = false,
  refetchMastery,
  locale,
  onSkillClick,
  onPracticeClick,
  completedSections,
  totalSections,
  completedLessons,
  totalLessons,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [justUnlockedSkills, setJustUnlockedSkills] = useState<Set<string>>(
    () => new Set()
  );
  const prevProficiencyMapRef = useRef<Map<string, number>>(new Map());
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextMap = new Map<string, number>(
      weakestSkills.map((s) => [s.skill, s.proficiency])
    );
    const prevMap = prevProficiencyMapRef.current;
    const newlyUnlocked = new Set<string>();

    for (const [skill, proficiency] of nextMap.entries()) {
      if (proficiency > JUST_UNLOCKED_THRESHOLD) continue;
      const prevProficiency = prevMap.get(skill);
      if (
        prevProficiency === undefined ||
        prevProficiency > JUST_UNLOCKED_THRESHOLD
      ) {
        newlyUnlocked.add(skill);
      }
    }

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setJustUnlockedSkills(newlyUnlocked);
    prevProficiencyMapRef.current = nextMap;

    if (newlyUnlocked.size > 0) {
      clearTimerRef.current = setTimeout(() => setJustUnlockedSkills(new Set()), 5000);
    }

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [weakestSkills]);

  if (!show) return null;

  if (masteryError) {
    return (
      <View style={{ marginTop: spacing.lg }}>
        <ErrorState
          message={`${t("dashboard.weakSkills.failedLoadSkills")}: ${t("dashboard.weakSkills.couldNotFetchSkills")}`}
          onRetry={refetchMastery}
        />
      </View>
    );
  }

  if (weakestSkills.length === 0) {
    if (!hasAnyMasteryData) {
      return (
        <GlassCard padding="lg" style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {t("dashboard.weakSkills.skillInsights")}
          </Text>
          <Text style={[styles.desc, { color: c.textMuted }]}>
            {t("dashboard.weakSkills.skillInsightsDesc")}
          </Text>
        </GlassCard>
      );
    }
    return (
      <GlassCard padding="lg" style={{ marginTop: spacing.lg }}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {t("dashboard.weakSkills.noWeakSkills")}
        </Text>
        <Text style={[styles.desc, { color: c.textMuted }]}>
          {t("dashboard.weakSkills.noWeakSkillsDesc")}
        </Text>
      </GlassCard>
    );
  }

  const safeCompletedSections = completedSections ?? 0;
  const safeTotalSections = totalSections ?? 0;
  const safeCompletedLessons = completedLessons ?? 0;
  const safeTotalLessons = totalLessons ?? 0;

  return (
    <GlassCard padding="md" style={{ marginTop: spacing.lg, borderColor: c.border }}>
      <Text style={[styles.h2, { color: c.text }]}>
        {t("dashboard.weakSkills.areasToImprove")}
      </Text>
      <Text style={[styles.focus, { color: c.textMuted }]}>
        {t("dashboard.weakSkills.focusOnSkills")}
      </Text>
      <Text style={[styles.lessonsMeta, { color: c.textMuted }]}>
        {t("dashboard.skillInsights.sectionsAndLessons", {
          sections: `${safeCompletedSections}/${Math.max(1, safeTotalSections)}`,
          lessons: `${safeCompletedLessons}/${Math.max(1, safeTotalLessons)}`,
        })}
      </Text>
      <View style={styles.grid}>
        {weakestSkills.map((skill) => (
          <View
            key={skill.skill}
            style={[styles.skillCard, { borderColor: c.border, backgroundColor: c.surface }]}
          >
            <Pressable
              onPress={() => onSkillClick?.(skill)}
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.weakSkills.practiceSkillAria", {
                skill: skill.skill,
              })}
            >
              <View style={styles.skillHeader}>
                <Text style={[styles.skillName, { color: c.text }]} numberOfLines={2}>
                  {skill.skill}
                </Text>
                <View style={styles.skillHeaderRight}>
                  {justUnlockedSkills.has(skill.skill) ? (
                    <Text style={styles.badge}>{t("dashboard.skillInsights.justUnlocked")}</Text>
                  ) : null}
                  <Text style={[styles.pct, { color: c.textMuted }]}>
                    {formatPct(skill.proficiency, locale)}
                  </Text>
                </View>
              </View>
              <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                <View
                  style={[styles.barFill, { width: `${skill.proficiency}%`, backgroundColor: c.primary }]}
                />
              </View>
              <Text style={[styles.lowMastery, { color: c.textMuted }]}>
                {t("dashboard.weakSkills.lowMasteryIn", { skill: skill.skill })}
              </Text>
              {skill.level_label ? (
                <Text style={[styles.levelLabel, { color: c.textMuted }]}>
                  {skill.level_label}
                </Text>
              ) : null}
            </Pressable>
            <GlassButton
              variant="ghost"
              size="sm"
              onPress={() => onPracticeClick?.(skill)}
            >
              {t("dashboard.weakSkills.practice")}
            </GlassButton>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: typography.md, fontWeight: "800", marginBottom: spacing.sm },
  desc: { fontSize: typography.sm, lineHeight: 20 },
  h2: { fontSize: typography.md, fontWeight: "800", marginBottom: spacing.sm },
  focus: { fontSize: typography.sm, marginBottom: spacing.xs },
  lessonsMeta: { fontSize: typography.xs, marginBottom: spacing.md, lineHeight: 18 },
  grid: { gap: spacing.md },
  skillCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skillHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  skillName: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  skillHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#059669",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  pct: { fontSize: typography.xs, fontWeight: "600" },
  barTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: spacing.sm },
  barFill: { height: "100%", borderRadius: 4 },
  lowMastery: { fontSize: typography.xs, marginTop: spacing.sm },
  levelLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", marginTop: 4 },
});
