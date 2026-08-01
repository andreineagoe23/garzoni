import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type {
  StakeRewardRow,
  StreakWagerDto,
  StreakWagerIneligibleReason,
} from "@garzoni/core";
import GlassCard from "../ui/GlassCard";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import { daysLeftToDeadline, previewDeadlineOn } from "./wagerHelpers";

export type StreakWagerCardProps = {
  active: StreakWagerDto | null;
  /** Most recent past wagers (won/lost/cancelled), newest first. */
  history: StreakWagerDto[];
  stakeRewardTable: StakeRewardRow[];
  eligible: boolean;
  ineligibleReason: StreakWagerIneligibleReason;
  /** Busy while an open/cancel request is in flight — disables actions. */
  busy: boolean;
  onOpen: (targetDays: number) => void;
  onCancel: (wagerId: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

const DEFAULT_TARGET_DAYS = 7;

function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function StreakWagerCard({
  active,
  history,
  stakeRewardTable,
  eligible,
  ineligibleReason,
  busy,
  onOpen,
  onCancel,
  t,
}: StreakWagerCardProps) {
  const c = useThemeColors();
  const [selectedDays, setSelectedDays] = useState(DEFAULT_TARGET_DAYS);
  const today = useMemo(() => todayIso(), []);

  const selectedRow =
    stakeRewardTable.find((row) => row.target_days === selectedDays) ??
    stakeRewardTable[0] ??
    null;

  if (active) {
    const daysLeft = daysLeftToDeadline(active.deadline_on, today);
    return (
      <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("wagers.title")}
          </Text>
          <View style={[styles.badge, { backgroundColor: `${c.primary}22` }]}>
            <Text style={[styles.badgeText, { color: c.primary }]}>
              {t("wagers.active.badge")}
            </Text>
          </View>
        </View>

        <Text style={[styles.stakeLine, { color: c.textMuted }]}>
          {t("wagers.active.stakeLine", {
            stake: active.stake_points,
            reward: active.reward_points,
            coins: active.reward_coins,
          })}
        </Text>

        <Text style={[styles.countdown, { color: c.primary }]}>
          {daysLeft <= 0
            ? t("wagers.active.endsToday")
            : t("wagers.active.daysLeft", { count: daysLeft })}
        </Text>

        {active.can_cancel ? (
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("wagers.active.cancel")}
            onPress={() => {
              Alert.alert(
                t("wagers.active.cancelConfirmTitle"),
                t("wagers.active.cancelConfirmBody", {
                  stake: active.stake_points,
                }),
                [
                  { text: t("wagers.open.confirmCancel"), style: "cancel" },
                  {
                    text: t("wagers.active.cancel"),
                    style: "destructive",
                    onPress: () => onCancel(active.id),
                  },
                ],
              );
            }}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                opacity: pressed || busy ? 0.7 : 1,
                borderColor: `${c.error}66`,
              },
            ]}
          >
            <Text style={[styles.cancelBtnText, { color: c.error }]}>
              {t("wagers.active.cancel")}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.cancelClosed, { color: c.textFaint }]}>
            {t("wagers.active.cancelWindowClosed")}
          </Text>
        )}
      </GlassCard>
    );
  }

  const recentHistory = history.slice(0, 3);

  return (
    <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
      <Text style={[styles.title, { color: c.text }]}>{t("wagers.title")}</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        {t("wagers.subtitle")}
      </Text>

      {!eligible ? (
        <Text style={[styles.ineligible, { color: c.textFaint }]}>
          {ineligibleReason === "streak_too_low"
            ? t("wagers.eligibility.streakTooLow")
            : ineligibleReason === "insufficient_points"
              ? t("wagers.eligibility.insufficientPoints")
              : t("wagers.eligibility.activeExists")}
        </Text>
      ) : (
        <>
          <View style={styles.chipRow}>
            {stakeRewardTable.map((row) => {
              const isSelected = row.target_days === selectedDays;
              return (
                <Pressable
                  key={row.target_days}
                  accessibilityRole="button"
                  accessibilityLabel={t("wagers.open.days", {
                    count: row.target_days,
                  })}
                  onPress={() => setSelectedDays(row.target_days)}
                  style={[
                    styles.chip,
                    {
                      borderColor: isSelected ? c.primary : c.border,
                      backgroundColor: isSelected
                        ? `${c.primary}18`
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipDays,
                      { color: isSelected ? c.primary : c.text },
                    ]}
                  >
                    {t("wagers.open.days", { count: row.target_days })}
                  </Text>
                  <Text style={[styles.chipStake, { color: c.textMuted }]}>
                    {t("wagers.open.stakeXp", { stake: row.stake_points })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedRow ? (
            <Text style={[styles.rewardLine, { color: c.textMuted }]}>
              {t("wagers.open.rewardLine", {
                reward: selectedRow.reward_points,
                coins: selectedRow.reward_coins,
              })}
            </Text>
          ) : null}

          <Pressable
            disabled={busy || !selectedRow}
            accessibilityRole="button"
            accessibilityLabel={t("wagers.open.cta")}
            onPress={() => {
              if (!selectedRow) return;
              const deadline = previewDeadlineOn(
                selectedRow.target_days,
                today,
              );
              Alert.alert(
                t("wagers.open.confirmTitle", {
                  stake: selectedRow.stake_points,
                  count: selectedRow.target_days,
                }),
                t("wagers.open.confirmBody", {
                  stake: selectedRow.stake_points,
                  date: deadline,
                  reward: selectedRow.reward_points,
                  coins: selectedRow.reward_coins,
                }),
                [
                  { text: t("wagers.open.confirmCancel"), style: "cancel" },
                  {
                    text: t("wagers.open.confirmConfirm"),
                    style: "destructive",
                    onPress: () => onOpen(selectedRow.target_days),
                  },
                ],
              );
            }}
            style={({ pressed }) => [
              styles.startBtn,
              {
                opacity: pressed || busy || !selectedRow ? 0.7 : 1,
                backgroundColor: c.primary,
              },
            ]}
          >
            <Text style={[styles.startBtnText, { color: c.textOnPrimary }]}>
              {t("wagers.open.cta")}
            </Text>
          </Pressable>
        </>
      )}

      {recentHistory.length > 0 ? (
        <View style={styles.historyRow}>
          {recentHistory.map((wager) => (
            <View
              key={wager.id}
              style={[
                styles.historyPill,
                {
                  borderColor: c.border,
                  backgroundColor:
                    wager.status === "won"
                      ? `${c.success}18`
                      : wager.status === "lost"
                        ? `${c.error}12`
                        : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.historyPillText,
                  {
                    color:
                      wager.status === "won"
                        ? c.success
                        : wager.status === "lost"
                          ? c.error
                          : c.textFaint,
                  },
                ]}
              >
                {wager.status === "won"
                  ? t("wagers.history.won", { reward: wager.reward_points })
                  : wager.status === "lost"
                    ? t("wagers.history.lost", { stake: wager.stake_points })
                    : t("wagers.history.cancelled")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: typography.md, fontWeight: "800" },
  subtitle: { fontSize: typography.sm, marginTop: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  stakeLine: { marginTop: spacing.md, fontSize: typography.sm },
  countdown: {
    marginTop: spacing.xs,
    fontSize: typography.lg,
    fontWeight: "800",
  },
  ineligible: { marginTop: spacing.md, fontSize: typography.sm },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 76,
    alignItems: "center",
  },
  chipDays: { fontSize: typography.sm, fontWeight: "800" },
  chipStake: { fontSize: 11, marginTop: 2 },
  rewardLine: {
    marginTop: spacing.md,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  startBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  startBtnText: { fontSize: typography.sm, fontWeight: "700" },
  cancelBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: typography.xs, fontWeight: "700" },
  cancelClosed: { marginTop: spacing.md, fontSize: typography.xs },
  historyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  historyPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  historyPillText: { fontSize: 11, fontWeight: "700" },
});
