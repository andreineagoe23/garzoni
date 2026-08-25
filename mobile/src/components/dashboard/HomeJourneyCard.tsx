import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  buildJourneyLayout,
  buildProgressByCourse,
  derivePersonalizedPathState,
  fetchPersonalizedPath,
  fetchProgressSummary,
  queryKeys,
  staleTimes,
  type ProgressSummary,
} from "@garzoni/core";
import { href } from "../../navigation/href";
import { trackEvent } from "../../lib/analytics";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography, shadows } from "../../theme/tokens";

/**
 * The Climb, surfaced on Home (3.2): a compact progress card that deep-links
 * into the Learn tab's journey mode. Renders nothing until the personalized
 * path has courses, so it only appears for users with a personalized path.
 * The Home tab already gates this behind questionnaire completion.
 */
export default function HomeJourneyCard() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const { width } = useWindowDimensions();

  const personalizedQuery = useQuery({
    queryKey: queryKeys.personalizedPath(),
    queryFn: () => fetchPersonalizedPath().then((r) => r.data),
    staleTime: 60_000,
  });

  const progressSummaryQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () =>
      fetchProgressSummary().then((r) => r.data as ProgressSummary),
    staleTime: staleTimes.progressSummary,
  });

  const progressByCourse = useMemo(
    () => buildProgressByCourse(progressSummaryQuery.data),
    [progressSummaryQuery.data],
  );

  const { courses, hasCourses } = useMemo(
    () => derivePersonalizedPathState(personalizedQuery.data),
    [personalizedQuery.data],
  );

  const layout = useMemo(
    () => buildJourneyLayout(courses, progressByCourse, width),
    [courses, progressByCourse, width],
  );

  const percent = useMemo(() => {
    const unlocked = layout.nodes.filter((n) => n.state !== "locked");
    if (unlocked.length === 0) {
      return Math.round(
        Number(personalizedQuery.data?.meta?.overall_completion ?? 0),
      );
    }
    return Math.round(
      unlocked.reduce((sum, n) => sum + n.metrics.percent, 0) / unlocked.length,
    );
  }, [layout.nodes, personalizedQuery.data?.meta?.overall_completion]);

  // Don't flash an empty-state card while the path request is still in flight.
  if (personalizedQuery.isLoading) return null;

  const currentNode =
    layout.currentIndex >= 0 ? layout.nodes[layout.currentIndex] : null;
  const nextTitle =
    currentNode?.course.title ?? t("dashboard.climbCard.summit");

  const openJourney = () => {
    trackEvent("journey_view", {
      source: "home_card",
      state: hasCourses ? "in_progress" : "empty",
    });
    // Same destination either way — Learn's personalized view builds the path
    // when there isn't one yet.
    router.push(href("/(tabs)/learn?view=personalized"));
  };

  return (
    <Pressable
      onPress={openJourney}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: c.primary,
          borderColor: c.primaryDark,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[styles.iconTile, { backgroundColor: "rgba(255,255,255,0.16)" }]}
      >
        <MaterialCommunityIcons name="terrain" size={22} color="#ffffff" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {t("dashboard.climbCard.eyebrow").toUpperCase()} ·{" "}
          {hasCourses
            ? t("dashboard.climbCard.percentClimbed", { percent })
            : t("dashboard.climbCard.startEyebrow")}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {hasCourses
            ? t("dashboard.climbCard.next", { title: nextTitle })
            : t("dashboard.climbCard.startTitle")}
        </Text>
        {hasCourses ? (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(2, Math.min(100, percent))}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderBottomWidth: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 5 },
  eyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontSize: typography.xs,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  title: {
    color: "#ffffff",
    fontSize: typography.md,
    fontWeight: "800",
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
});
