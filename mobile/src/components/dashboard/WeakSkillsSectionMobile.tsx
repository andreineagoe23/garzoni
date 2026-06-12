import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { masteryLevelLabel, weakSkillNextStepLabels } from "@garzoni/core";
import type { DashboardWeakSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";
import { gridFlexBasis, useResponsive } from "../../utils/platform";
import ErrorState from "../ui/ErrorState";

function formatPct(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.min(100, Math.max(0, n)) / 100);
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

type PillKind = "due" | "overdue" | "declining" | "improving" | null;

function pillFor(skill: DashboardWeakSkill): {
  kind: PillKind;
  args?: Record<string, number>;
} {
  if (skill.is_due_now) {
    const days = skill.overdue_days ?? 0;
    if (days >= 1) return { kind: "overdue", args: { days } };
    return { kind: "due" };
  }
  const delta = skill.delta_7d ?? 0;
  if (delta <= -3) return { kind: "declining" };
  if (delta >= 3) return { kind: "improving", args: { delta } };
  return { kind: null };
}

type Props = {
  show?: boolean;
  masteryError?: unknown;
  weakestSkills?: DashboardWeakSkill[];
  strongestSkills?: DashboardWeakSkill[];
  hasAnyMasteryData?: boolean;
  refetchMastery?: () => void;
  locale?: string;
  onPrimaryAction?: (skill: DashboardWeakSkill) => void;
  onAskTutor?: (skill: DashboardWeakSkill) => void;
};

export default function WeakSkillsSectionMobile({
  show = true,
  masteryError,
  weakestSkills = [],
  strongestSkills = [],
  hasAnyMasteryData = false,
  refetchMastery,
  locale,
  onPrimaryAction,
  onAskTutor,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const { gridColumns } = useResponsive();

  // Phone: stacked single column. Tablet: 2-up. Large tablet: 3-up.
  const cols = gridColumns(1, 2, 3);
  const gridStyle =
    cols > 1
      ? [styles.grid, styles.gridRow]
      : styles.grid;
  const cardWidthStyle =
    cols > 1
      ? { flexBasis: gridFlexBasis(cols), flexGrow: 1, minWidth: 0 }
      : null;

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
    // All skills strong — invert sort and show top 3 strongest.
    return (
      <GlassCard padding="lg" style={{ marginTop: spacing.lg }}>
        <Text style={[styles.h2, { color: c.text }]}>
          {t("dashboard.weakSkills.strongest.title")}
        </Text>
        <Text style={[styles.focus, { color: c.textMuted }]}>
          {t("dashboard.weakSkills.strongest.subtitle")}
        </Text>
        <View style={gridStyle}>
          {strongestSkills.slice(0, 3).map((skill) => (
            <View
              key={skill.skill}
              style={[
                styles.skillCard,
                cardWidthStyle,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <View style={styles.skillHeader}>
                <Text
                  style={[styles.skillName, { color: c.text }]}
                  numberOfLines={2}
                >
                  {skill.skill}
                </Text>
                <Text style={[styles.pct, { color: c.textMuted }]}>
                  {formatPct(skill.proficiency, locale)}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${skill.proficiency}%`,
                      backgroundColor: c.success,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      padding="md"
      style={{ marginTop: spacing.lg, borderColor: c.border }}
    >
      <Text style={[styles.h2, { color: c.text }]}>
        {t("dashboard.weakSkills.areasToImprove")}
      </Text>
      <Text style={[styles.focus, { color: c.textMuted }]}>
        {t("dashboard.weakSkills.focusOnSkills")}
      </Text>
      <View style={gridStyle}>
        {weakestSkills.map((skill) => {
          const pill = pillFor(skill);
          const { ctaLabel, preview } = weakSkillNextStepLabels(
            t,
            skill.next_step,
          );
          const displayTitle = skill.course_title || skill.skill;
          const isTutorOnly = skill.next_step?.type === "tutor";
          const primaryLabel = isTutorOnly
            ? t("dashboard.weakSkills.action.askTutorAbout", {
                skill: displayTitle,
              })
            : ctaLabel;
          const isDue = skill.next_step?.type === "review";
          const lastPracticedDays = daysSince(skill.last_reviewed);
          const pillBg =
            pill.kind === "due" || pill.kind === "overdue"
              ? c.errorBg
              : pill.kind === "declining"
                ? "rgba(245,158,11,0.15)"
                : pill.kind === "improving"
                  ? c.successBg
                  : "transparent";
          const pillFg =
            pill.kind === "due" || pill.kind === "overdue"
              ? c.error
              : pill.kind === "declining"
                ? "#f59e0b"
                : pill.kind === "improving"
                  ? c.success
                  : c.textMuted;

          return (
            <View
              key={skill.skill}
              style={[
                styles.skillCard,
                cardWidthStyle,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <View style={styles.skillHeader}>
                <Text
                  style={[styles.skillName, { color: c.text }]}
                  numberOfLines={2}
                >
                  {displayTitle}
                </Text>
                <View style={styles.skillHeaderRight}>
                  {pill.kind ? (
                    <Text
                      style={[
                        styles.pill,
                        { color: pillFg, backgroundColor: pillBg },
                      ]}
                    >
                      {pill.kind === "due"
                        ? t("dashboard.weakSkills.pill.dueNow")
                        : pill.kind === "overdue"
                          ? t("dashboard.weakSkills.pill.overdue", pill.args)
                          : pill.kind === "declining"
                            ? t("dashboard.weakSkills.pill.declining")
                            : t(
                                "dashboard.weakSkills.pill.improving",
                                pill.args,
                              )}
                    </Text>
                  ) : null}
                  <Text style={[styles.pct, { color: c.textMuted }]}>
                    {formatPct(skill.proficiency, locale)}
                  </Text>
                </View>
              </View>
              <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${skill.proficiency}%`,
                      backgroundColor: c.primary,
                    },
                  ]}
                />
              </View>
              {skill.level_band || skill.level_label ? (
                <Text style={[styles.levelLabel, { color: c.textMuted }]}>
                  {skill.level_band
                    ? masteryLevelLabel(t, skill.level_band)
                    : skill.level_label}
                </Text>
              ) : null}
              {preview ? (
                <Text style={[styles.context, { color: c.textMuted }]}>
                  {preview}
                </Text>
              ) : null}
              {lastPracticedDays != null ? (
                <Text style={[styles.context, { color: c.textMuted }]}>
                  {lastPracticedDays === 0
                    ? t("dashboard.weakSkills.context.lastPracticedToday")
                    : lastPracticedDays === 1
                      ? t("dashboard.weakSkills.context.lastPracticedYesterday")
                      : t("dashboard.weakSkills.context.lastPracticed", {
                          days: lastPracticedDays,
                        })}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <GlassButton
                  variant={isDue ? "active" : "secondary"}
                  size="sm"
                  onPress={() => onPrimaryAction?.(skill)}
                >
                  {primaryLabel}
                </GlassButton>
                {!isTutorOnly ? (
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onPress={() => onAskTutor?.(skill)}
                  >
                    {t("dashboard.weakSkills.action.askTutor")}
                  </GlassButton>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  desc: { fontSize: typography.sm, lineHeight: 20 },
  h2: { fontSize: typography.md, fontWeight: "800", marginBottom: spacing.sm },
  focus: { fontSize: typography.sm, marginBottom: spacing.md },
  grid: { gap: spacing.md },
  gridRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  skillCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  skillName: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  skillHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  pct: { fontSize: typography.xs, fontWeight: "600" },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  barFill: { height: "100%", borderRadius: 4 },
  levelLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  context: { fontSize: typography.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
