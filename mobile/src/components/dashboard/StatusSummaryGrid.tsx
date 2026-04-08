import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassButton from "../ui/GlassButton";
import KPIScrollRow, { KPITile } from "./KPIScrollRow";
import { spacing, typography, radius } from "../../theme/tokens";

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
  reviewError?: unknown;
  missionsError?: unknown;
  refetchReview?: () => void;
  refetchMissions?: () => void;
  reviewTopSkill?: string | null;
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
  reviewError,
  missionsError,
  refetchReview,
  refetchMissions,
  reviewTopSkill,
  onOpenReviews,
  onOpenMissions,
  locale,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  return (
    <View style={styles.wrap}>
      <KPIScrollRow>
        <KPITile>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.dailyGoal.label")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatPct(dailyGoalProgress, locale)}
          </Text>
        </KPITile>

        <KPITile>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.overallProgress")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatPct(overallProgress, locale)}
          </Text>
        </KPITile>

        <KPITile>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.coursesCompleted")}
          </Text>
          <Text style={[styles.value, { color: c.text }]}>
            {formatNum(coursesCompleted, locale)}
          </Text>
        </KPITile>

        {reviewError ? null : (
          <KPITile
            urgent={reviewsDue > 0}
            onPress={
              reviewsDue > 0 && onOpenReviews ? onOpenReviews : undefined
            }
          >
            <View style={styles.rowBetween}>
              <View style={styles.iconRow}>
                <MaterialCommunityIcons
                  name="sync"
                  size={16}
                  color={reviewsDue > 0 ? c.error : c.textMuted}
                />
                <Text
                  style={[
                    styles.label,
                    {
                      color: reviewsDue > 0 ? c.error : c.textMuted,
                      marginBottom: 0,
                    },
                  ]}
                >
                  {t("dashboard.statusSummary.reviewsDue")}
                </Text>
              </View>
              {reviewsDue > 0 ? (
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
                { color: reviewsDue > 0 ? c.error : c.text },
              ]}
            >
              {formatNum(reviewsDue, locale)}
            </Text>
            {reviewTopSkill ? (
              <Text
                style={[styles.meta, { color: c.textMuted }]}
                numberOfLines={2}
              >
                {t("dashboard.statusSummary.nextReviewSkill", {
                  skill: reviewTopSkill,
                })}
              </Text>
            ) : null}
            {onOpenReviews && reviewsDue > 0 ? (
              <GlassButton variant="primary" size="sm" onPress={onOpenReviews}>
                {t("dashboard.statusSummary.startReviews")}
              </GlassButton>
            ) : null}
          </KPITile>
        )}

        {missionsError ? null : (
          <KPITile onPress={onOpenMissions}>
            <View style={styles.iconRow}>
              <MaterialCommunityIcons
                name="rocket-launch"
                size={16}
                color={c.textMuted}
              />
              <Text
                style={[styles.label, { color: c.textMuted, marginBottom: 0 }]}
              >
                {t("dashboard.statusSummary.activeMissions")}
              </Text>
            </View>
            <Text style={[styles.value, { color: c.text }]}>
              {formatNum(activeMissionsCount, locale)}
            </Text>
          </KPITile>
        )}

        <KPITile>
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
        </KPITile>
      </KPIScrollRow>

      {reviewError ? (
        <View
          style={[
            styles.errorTile,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.label, { color: c.error }]}>
            {t("dashboard.statusSummary.failedLoadReviews")}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.couldNotFetchReviews")}
          </Text>
          {refetchReview ? (
            <GlassButton variant="primary" size="sm" onPress={refetchReview}>
              {t("onboarding.reminderBanner.tryAgain")}
            </GlassButton>
          ) : null}
        </View>
      ) : null}

      {missionsError ? (
        <View
          style={[
            styles.errorTile,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.label, { color: c.error }]}>
            {t("dashboard.statusSummary.failedLoadMissions")}
          </Text>
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {t("dashboard.statusSummary.couldNotFetchMissions")}
          </Text>
          {refetchMissions ? (
            <GlassButton variant="primary" size="sm" onPress={refetchMissions}>
              {t("onboarding.reminderBanner.tryAgain")}
            </GlassButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorTile: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: { fontSize: typography.xs, fontWeight: "600", marginBottom: 4 },
  value: { fontSize: typography.xl, fontWeight: "800" },
  meta: { fontSize: typography.xs, lineHeight: 18 },
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
