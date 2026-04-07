import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { FinanceFact, Mission } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import ProgressBar from "../ui/ProgressBar";
import { spacing, typography } from "../../theme/tokens";
import FactCard from "./FactCard";
import CoinStack from "./CoinStack";

export type MissionCardProps = {
  mission: Mission;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  canSwap: boolean;
  onSwap: (missionId: number) => void;
  showSavingsMenu: boolean;
  onToggleSavingsMenu: () => void;
  virtualBalance: number;
  currentFact: FinanceFact | null;
  factLoading?: boolean;
  onMarkFactRead: () => void;
  onLoadFact: () => void;
  savingsAmount: string;
  onSavingsAmountChange: (value: string) => void;
  onSavingsSubmit: () => void;
  getLessonRequirement: (mission: Mission) => number;
  purposeStatement: (mission: Mission) => string;
};

export default function MissionCard({
  mission,
  isDaily,
  t,
  canSwap,
  onSwap,
  showSavingsMenu,
  onToggleSavingsMenu,
  virtualBalance,
  currentFact,
  factLoading,
  onMarkFactRead,
  onLoadFact,
  savingsAmount,
  onSavingsAmountChange,
  onSavingsSubmit,
  getLessonRequirement,
  purposeStatement,
}: MissionCardProps) {
  const c = useThemeColors();
  const progressPercent = Math.min(100, Math.round(Number(mission.progress ?? 0)));
  const isCompleted = mission.status === "completed";
  const title = mission.mission_name || mission.name || t("missions.missionFallback");
  const mid = Number(mission.id);

  const progressLabel =
    mission.goal_type === "read_fact" && !isDaily
      ? t("missions.progress.factsCount", {
          count: Math.floor(progressPercent / 20),
        })
      : t("missions.progress.percent", { value: progressPercent });

  const progressDetail =
    mission.goal_type === "read_fact" && isDaily
      ? t("missions.progress.readOneFact")
      : mission.goal_type === "read_fact"
        ? t("missions.progress.factsRemaining", {
            count: 5 - Math.floor(progressPercent / 20),
          })
        : mission.goal_type === "complete_lesson"
          ? t("missions.progress.lessonTarget", {
              value: progressPercent,
              lessons: getLessonRequirement(mission),
            })
          : t("missions.progress.complete", { value: progressPercent });

  const completedLessons =
    mission.goal_type === "complete_lesson"
      ? Math.min(
          getLessonRequirement(mission),
          Math.round(
            (Math.max(Number(mission.progress ?? 0), 0) / 100) *
              getLessonRequirement(mission)
          )
        )
      : null;

  const coinUnit = isDaily ? 1 : 10;
  const target = isDaily ? 10 : 100;

  return (
    <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.accent }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={[styles.badge, { backgroundColor: `${c.primary}22` }]}>
            <Text style={[styles.badgeText, { color: c.primary }]}>
              {isDaily ? t("missions.badge.daily") : t("missions.badge.weekly")}
            </Text>
          </View>
        </View>
        {mission.description ? (
          <Text style={[styles.desc, { color: c.textMuted }]} numberOfLines={6}>
            {mission.description}
          </Text>
        ) : null}
        <Text style={[styles.why, { color: c.accent }]}>
          {t("missions.why")} {purposeStatement(mission)}
        </Text>

        <View style={styles.progressBlock}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: c.textMuted }]}>
              {t("missions.progress.label")}
            </Text>
            <Text style={[styles.progressValue, { color: c.text }]}>
              {progressLabel}
            </Text>
          </View>
          <ProgressBar
            value={progressPercent / 100}
            color={c.primary}
            style={{ marginTop: spacing.xs }}
          />
          <Text style={[styles.progressDetail, { color: c.textMuted }]}>
            {isCompleted ? t("missions.progress.completed") : progressDetail}
          </Text>
          {completedLessons !== null ? (
            <Text style={[styles.levelTarget, { color: c.textFaint }]}>
              {t("missions.progress.levelTarget", {
                lessons: getLessonRequirement(mission),
                plural: getLessonRequirement(mission) !== 1 ? "s" : "",
                completed: completedLessons,
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {isCompleted ? (
        <View
          style={[
            styles.completeBox,
            { borderColor: "rgba(16,185,129,0.4)", backgroundColor: "rgba(16,185,129,0.1)" },
          ]}
        >
          <View style={styles.completeRow}>
            <Text style={[styles.completeTitle, { color: "#047857" }]}>
              {t("missions.complete.title")}
            </Text>
            <Text style={[styles.completeTitle, { color: "#047857" }]}>
              +{mission.points_reward ?? 0} XP
            </Text>
          </View>
          <Text style={[styles.completeSub, { color: "#047857" }]}>
            {t("missions.complete.subtitle")}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          {canSwap && isDaily ? (
            <Pressable
              accessibilityLabel={t("missions.swap.aria", { name: title })}
              onPress={() => onSwap(mid)}
              style={({ pressed }) => [
                styles.swapBtn,
                {
                  opacity: pressed ? 0.85 : 1,
                  borderColor: `${c.accent}66`,
                  backgroundColor: `${c.accent}18`,
                },
              ]}
            >
              <Text style={[styles.swapBtnText, { color: c.accent }]}>
                {t("missions.swap.label")}
              </Text>
            </Pressable>
          ) : null}

          {mission.goal_type === "add_savings" ? (
            <GlassCard padding="md" style={{ backgroundColor: `${c.bg}99` }}>
              <Pressable
                onPress={onToggleSavingsMenu}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed ? 0.9 : 1, backgroundColor: c.primary },
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
                  {showSavingsMenu
                    ? t("missions.savings.hideJar")
                    : t("missions.savings.showJar")}
                </Text>
              </Pressable>
              {showSavingsMenu ? (
                <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                  <CoinStack
                    balance={virtualBalance}
                    coinUnit={coinUnit}
                    target={target}
                    t={t}
                  />
                  <Text style={[styles.note, { color: c.textMuted }]}>
                    {t("missions.savings.suggestedNote")}
                  </Text>
                  <View style={styles.formRow}>
                    <TextInput
                      value={savingsAmount}
                      onChangeText={onSavingsAmountChange}
                      placeholder={
                        isDaily
                          ? t("missions.savings.placeholderDaily")
                          : t("missions.savings.placeholderWeekly")
                      }
                      placeholderTextColor={c.textFaint}
                      keyboardType="decimal-pad"
                      style={[
                        styles.input,
                        {
                          borderColor: c.border,
                          backgroundColor: c.inputBg,
                          color: c.text,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={onSavingsSubmit}
                      style={({ pressed }) => [
                        styles.addBtn,
                        { opacity: pressed ? 0.9 : 1, backgroundColor: "#10b981" },
                      ]}
                    >
                      <Text style={styles.addBtnText}>{t("missions.savings.add")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </GlassCard>
          ) : null}

          {mission.goal_type === "read_fact" && isDaily ? (
            <FactCard
              fact={currentFact}
              loading={factLoading}
              onMarkRead={onMarkFactRead}
              onTryAgain={onLoadFact}
              t={t}
            />
          ) : null}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { flex: 1, fontSize: typography.md, fontWeight: "700" },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  desc: { fontSize: typography.sm, lineHeight: 20 },
  why: { fontSize: typography.xs, fontWeight: "700", marginTop: spacing.xs },
  progressBlock: { marginTop: spacing.md },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: { fontSize: typography.xs, fontWeight: "700" },
  progressValue: { fontSize: typography.xs, fontWeight: "700" },
  progressDetail: { fontSize: typography.xs, marginTop: spacing.xs },
  levelTarget: { fontSize: 10, marginTop: 4 },
  completeBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  completeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  completeTitle: { fontSize: typography.xs, fontWeight: "800" },
  completeSub: { fontSize: typography.xs, lineHeight: 18 },
  swapBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  swapBtnText: { fontSize: typography.xs, fontWeight: "700" },
  primaryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  primaryBtnText: { fontSize: typography.xs, fontWeight: "700" },
  note: { fontSize: typography.xs, lineHeight: 18 },
  formRow: { flexDirection: "column", gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: typography.sm,
  },
  addBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: typography.xs, fontWeight: "700" },
});
