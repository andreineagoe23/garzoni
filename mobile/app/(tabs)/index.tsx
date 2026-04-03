import { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { href } from "../../src/navigation/href";
import {
  fetchMissions,
  fetchProfile,
  fetchProgressSummary,
  fetchRecentActivity,
  fetchReviewQueue,
  queryKeys,
  staleTimes,
  useDashboardSummary,
  useHearts,
} from "@monevo/core";
import {
  Button,
  ErrorState,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import StatusSummaryRow from "../../src/components/dashboard/StatusSummaryRow";
import DailyGoalCard from "../../src/components/dashboard/DailyGoalCard";
import WeakSkillsCard from "../../src/components/dashboard/WeakSkillsCard";
import PersonalizedPathCard from "../../src/components/dashboard/PersonalizedPathCard";
import QuestionnaireReminderBanner from "../../src/components/dashboard/QuestionnaireReminderBanner";
import AllTopicsGrid from "../../src/components/dashboard/AllTopicsGrid";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../src/theme/tokens";

const DAILY_LESSON_GOAL = 3;

function todayCalendarKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function DashboardInner() {
  const c = useThemeColors();
  const progressQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () => fetchProgressSummary().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const activityQuery = useQuery({
    queryKey: queryKeys.recentActivity(),
    queryFn: () => fetchRecentActivity().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const reviewQuery = useQuery({
    queryKey: queryKeys.reviewQueue(),
    queryFn: () => fetchReviewQueue().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 30_000,
  });

  const { hearts, maxHearts } = useHearts({ enabled: true });

  const summary = useDashboardSummary({
    progressResponse: progressQuery.data
      ? { data: progressQuery.data }
      : undefined,
    reviewQueueData: reviewQuery.data,
    missionsData: missionsQuery.data,
    profile: profileQuery.data,
  });

  const refreshing =
    progressQuery.isFetching ||
    profileQuery.isFetching ||
    activityQuery.isFetching ||
    missionsQuery.isFetching;

  const onRefresh = useCallback(() => {
    void progressQuery.refetch();
    void profileQuery.refetch();
    void activityQuery.refetch();
    void missionsQuery.refetch();
    void reviewQuery.refetch();
  }, [progressQuery, profileQuery, activityQuery, missionsQuery, reviewQuery]);

  const dailyDone = (() => {
    const cal = profileQuery.data?.activity_calendar as Record<string, number> | undefined;
    if (!cal) return 0;
    return Number(cal[todayCalendarKey()] ?? 0);
  })();

  if (progressQuery.isPending) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Skeleton width="60%" height={28} style={{ marginBottom: spacing.lg }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
      </ScrollView>
    );
  }

  if (progressQuery.isError) {
    return (
      <ErrorState
        message="Could not load your dashboard."
        onRetry={() => void progressQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data;
  const recent = activityQuery.data?.recent_activities ?? [];
  const ud = profile?.user_data as { earned_money?: number } | undefined;
  const coins = Number(profile?.earned_money ?? ud?.earned_money ?? 0) || 0;
  const points = profile?.points ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
      }
    >
      <Text style={[styles.greeting, { color: c.text }]}>
        {profile?.first_name ? `Hey, ${profile.first_name} 👋` : "Welcome back 👋"}
      </Text>

      <View style={{ marginBottom: spacing.lg }}>
        <QuestionnaireReminderBanner />
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <StatusSummaryRow
          streak={profile?.streak ?? 0}
          points={points}
          hearts={hearts}
          maxHearts={maxHearts}
          coins={coins}
        />
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <PersonalizedPathCard resume={summary.resume} startHere={summary.startHere} />
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <DailyGoalCard
          progressPct={summary.dailyGoalProgress}
          currentXp={summary.dailyGoalCurrentXP}
          targetXp={summary.dailyGoalTargetXP}
        />
      </View>

      <View style={styles.lessonGoal}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Today&apos;s lessons</Text>
        <Text style={[styles.cardMeta, { color: c.textMuted }]}>
          {dailyDone} / {DAILY_LESSON_GOAL} lessons completed today
        </Text>
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <WeakSkillsCard />
      </View>

      <View style={styles.quickLinks}>
        <Text style={[styles.sectionHeading, { color: c.text }]}>Quick links</Text>
        <View style={styles.linkRow}>
          <Button size="sm" variant="secondary" onPress={() => router.push(href("/leaderboard"))}>
            Leaderboard
          </Button>
          <Button size="sm" variant="secondary" onPress={() => router.push(href("/rewards"))}>
            Rewards
          </Button>
        </View>
        <View style={styles.linkRow}>
          <Button size="sm" variant="secondary" onPress={() => router.push(href("/tools"))}>
            Tools
          </Button>
          <Button size="sm" variant="secondary" onPress={() => router.push(href("/missions"))}>
            Missions
          </Button>
        </View>
      </View>

      <View style={{ marginBottom: spacing.xxl }}>
        <AllTopicsGrid />
      </View>

      <Text style={[styles.sectionHeading, { color: c.text }]}>Recent activity</Text>
      {activityQuery.isPending ? (
        <Skeleton width="100%" height={48} style={{ marginBottom: spacing.sm }} />
      ) : recent.length === 0 ? (
        <Text style={[styles.emptyActivity, { color: c.textMuted }]}>
          Complete a lesson to see activity here.
        </Text>
      ) : (
        recent.map((item, i) => (
          <Pressable
            key={`${item.type}-${i}-${item.timestamp}`}
            style={[
              styles.activityRow,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
            onPress={() => {
              if (item.type === "lesson" && item.lesson_id != null) {
                router.push(`/lesson/${item.lesson_id}`);
              } else if (item.course_id != null) {
                router.push(`/course/${item.course_id}`);
              }
            }}
          >
            <Text style={[styles.activityTitle, { color: c.text }]} numberOfLines={1}>
              {item.title ?? item.name ?? item.type}
            </Text>
            {item.course ? (
              <Text style={[styles.activitySub, { color: c.textMuted }]} numberOfLines={1}>
                {item.course}
              </Text>
            ) : null}
          </Pressable>
        ))
      )}

      <View style={{ marginTop: spacing.xl }}>
        <MascotWithMessage mood="encourage" rotationKey={1} />
      </View>

      <Button
        variant="secondary"
        onPress={() => router.push("/(tabs)/learn")}
        style={{ marginTop: spacing.lg }}
      >
        Browse learning paths
      </Button>
    </ScrollView>
  );
}

export default function DashboardScreen() {
  return (
    <TabErrorBoundary>
      <DashboardInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingBottom: 60,
  },
  greeting: {
    fontSize: typography.xl,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  lessonGoal: { marginBottom: spacing.md },
  cardTitle: { fontSize: typography.sm, fontWeight: "700" },
  cardMeta: { fontSize: typography.xs, marginTop: 4 },
  sectionHeading: {
    fontSize: typography.md,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  quickLinks: { marginBottom: spacing.lg },
  linkRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  emptyActivity: {
    fontSize: typography.sm,
    marginBottom: spacing.lg,
  },
  activityRow: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityTitle: {
    fontSize: typography.base,
    fontWeight: "600",
  },
  activitySub: {
    fontSize: typography.xs,
    marginTop: 2,
  },
});
