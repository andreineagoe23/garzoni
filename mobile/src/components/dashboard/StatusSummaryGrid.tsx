import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassButton from "../ui/GlassButton";
import { KPITile } from "./KPIScrollRow";
import { spacing, typography } from "../../theme/tokens";

function formatPct(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.min(100, Math.max(0, n)) / 100);
}

function formatNum(n: number, locale?: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

type Props = {
  coursesCompleted: number;
  overallProgress: number;
  reviewsDue: number;
  activeMissionsCount: number;
  dailyGoalProgress: number;
  streakCount?: number;
  streakMeta?: {
    next_milestone?: number | null;
    days_to_next_milestone?: number;
    streak_at_risk?: boolean;
  };
  reviewError?: unknown;
  missionsError?: unknown;
  refetchReview?: () => void;
  refetchMissions?: () => void;
  onOpenReviews?: () => void;
  onOpenMissions?: () => void;
  locale?: string;
};

export default function StatusSummaryGrid({
  coursesCompleted,
  overallProgress,
  reviewsDue,
  activeMissionsCount,
  dailyGoalProgress,
  streakCount = 0,
  streakMeta,
  reviewError,
  missionsError,
  refetchReview,
  refetchMissions,
  onOpenReviews,
  onOpenMissions,
  locale,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  const reviewsUrgent = !reviewError && reviewsDue > 0;
  const reviewsPress =
    reviewError && refetchReview
      ? refetchReview
      : reviewsDue > 0 && onOpenReviews
        ? onOpenReviews
        : undefined;

  const missionsPress =
    missionsError && refetchMissions
      ? refetchMissions
      : activeMissionsCount > 0 && onOpenMissions
        ? onOpenMissions
        : undefined;

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <KPITile layout="grid">
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.dailyGoal.label")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatPct(dailyGoalProgress, locale)}
          </Text>
        </KPITile>

        <KPITile layout="grid">
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.overallProgress")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatPct(overallProgress, locale)}
          </Text>
        </KPITile>

        <KPITile layout="grid">
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.coursesCompleted")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatNum(coursesCompleted, locale)}
          </Text>
        </KPITile>

        <KPITile layout="grid">
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="fire" size={16} color={c.textMuted} />
            <Text
              style={[styles.label, { color: c.textMuted, marginBottom: 0 }]}
            >
              {t("dashboard.statusSummary.streak")}
            </Text>
          </View>
          <Text style={[styles.value, { color: c.text }]}>
            {formatNum(streakCount, locale)}
          </Text>
          {streakMeta?.streak_at_risk ? (
            <Text style={[styles.meta, { color: "#b45309" }]}>
              {t("dashboard.statusSummary.streakAtRisk")}
            </Text>
          ) : null}
        </KPITile>

        {/* Reviews — same 2-col grid as other KPIs */}
        <KPITile layout="grid" urgent={reviewsUrgent} onPress={reviewsPress}>
          {reviewError ? (
            <>
              <Text style={[styles.label, { color: c.error }]}>
                {t("dashboard.statusSummary.failedLoadReviews")}
              </Text>
              <Text
                style={[styles.meta, { color: c.textMuted }]}
                numberOfLines={3}
              >
                {t("dashboard.statusSummary.couldNotFetchReviews")}
              </Text>
              {refetchReview ? (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onPress={refetchReview}
                >
                  {t("onboarding.reminderBanner.tryAgain")}
                </GlassButton>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.rowBetween}>
                <View style={styles.iconRow}>
                  <MaterialCommunityIcons
                    name="sync"
                    size={16}
                    color={reviewsUrgent ? c.error : c.textMuted}
                  />
                  <Text
                    style={[
                      styles.label,
                      {
                        color: reviewsUrgent ? c.error : c.textMuted,
                        marginBottom: 0,
                      },
                    ]}
                  >
                    {t("dashboard.statusSummary.reviewsDue")}
                  </Text>
                </View>
                {reviewsUrgent ? (
                  <Text
                    style={[
                      styles.urgentPill,
                      { color: c.error, borderColor: `${c.error}55` },
                    ]}
                  >
                    {t("dashboard.statusSummary.urgent")}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.value,
                  { color: reviewsUrgent ? c.error : c.text },
                ]}
              >
                {formatNum(reviewsDue, locale)}
              </Text>
              <Text style={[styles.tileFoot, { color: c.textMuted }]}>
                {reviewsDue > 0
                  ? t("dashboard.statusSummary.reviewsTileHintTapPractice")
                  : t("dashboard.statusSummary.reviewsTileHintCaughtUp")}
              </Text>
            </>
          )}
        </KPITile>

        <KPITile layout="grid" onPress={missionsPress}>
          {missionsError ? (
            <>
              <Text style={[styles.label, { color: c.error }]}>
                {t("dashboard.statusSummary.failedLoadMissions")}
              </Text>
              <Text
                style={[styles.meta, { color: c.textMuted }]}
                numberOfLines={3}
              >
                {t("dashboard.statusSummary.couldNotFetchMissions")}
              </Text>
              {refetchMissions ? (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onPress={refetchMissions}
                >
                  {t("onboarding.reminderBanner.tryAgain")}
                </GlassButton>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.iconRow}>
                <MaterialCommunityIcons
                  name="rocket-launch"
                  size={16}
                  color={c.textMuted}
                />
                <Text
                  style={[
                    styles.label,
                    { color: c.textMuted, marginBottom: 0 },
                  ]}
                >
                  {t("dashboard.statusSummary.activeMissions")}
                </Text>
              </View>
              <Text style={[styles.value, { color: c.text }]}>
                {formatNum(activeMissionsCount, locale)}
              </Text>
              <Text style={[styles.tileFoot, { color: c.textMuted }]}>
                {activeMissionsCount > 0
                  ? t("dashboard.statusSummary.missionsTileHintTapOpen")
                  : t("dashboard.statusSummary.missionsTileHintIdle")}
              </Text>
            </>
          )}
        </KPITile>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  label: { fontSize: typography.xs, fontWeight: "600", marginBottom: 4 },
  value: { fontSize: typography.xl, fontWeight: "800" },
  meta: { fontSize: typography.xs, lineHeight: 18 },
  tileFoot: {
    fontSize: typography.xs,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  urgentPill: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
