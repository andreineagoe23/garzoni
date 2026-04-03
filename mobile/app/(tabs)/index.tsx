import { useCallback, useMemo } from "react";
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
import {
  fetchProfile,
  fetchProgressSummary,
  fetchRecentActivity,
  queryKeys,
  staleTimes,
  useHearts,
  useMascotMessage,
} from "@monevo/core";
import {
  Button,
  Card,
  CircularProgressRing,
  ErrorState,
  HeartBar,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import MascotImage from "../../src/components/common/MascotImage";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

const DAILY_LESSON_GOAL = 3;

function todayCalendarKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function DashboardInner() {
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

  const { hearts, maxHearts } = useHearts({ enabled: true });
  const { mascot, message } = useMascotMessage("encourage", { rotateMessages: true, rotationKey: 1 });

  const refreshing =
    progressQuery.isFetching || profileQuery.isFetching || activityQuery.isFetching;
  const onRefresh = useCallback(() => {
    void progressQuery.refetch();
    void profileQuery.refetch();
    void activityQuery.refetch();
  }, [progressQuery, profileQuery, activityQuery]);

  const dailyDone = useMemo(() => {
    const cal = profileQuery.data?.activity_calendar as Record<string, number> | undefined;
    if (!cal) return 0;
    return Number(cal[todayCalendarKey()] ?? 0);
  }, [profileQuery.data?.activity_calendar]);

  if (progressQuery.isPending) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton width="60%" height={28} style={{ marginBottom: spacing.lg }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
        <Skeleton width="100%" height={80} />
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

  const data = progressQuery.data;
  const profile = profileQuery.data;
  const recent = activityQuery.data?.recent_activities ?? [];

  const rawOverall = Number(data?.overall_progress ?? 0);
  const overallPct = rawOverall <= 1 ? rawOverall : rawOverall / 100;
  const overallLabel = `${Math.round(overallPct * 100)}%`;
  const lessonsDone = data?.completed_lessons ?? 0;
  const lessonsTotal = data?.total_lessons ?? 0;
  const streak = profile?.streak ?? 0;
  const resume = data?.resume;
  const startHere = data?.start_here;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.greeting}>
        {profile?.first_name
          ? `Hey, ${profile.first_name} 👋`
          : "Welcome back 👋"}
      </Text>

      {resume ? (
        <Card style={styles.resumeCard}>
          <Text style={styles.resumeLabel}>Continue learning</Text>
          <Text style={styles.resumeTitle}>{resume.course_title}</Text>
          <Button
            size="sm"
            onPress={() => router.push(`/course/${resume.course_id}`)}
          >
            Resume course
          </Button>
        </Card>
      ) : startHere?.course_id ? (
        <Card style={styles.resumeCard}>
          <Text style={styles.resumeLabel}>Start learning</Text>
          <Text style={styles.resumeTitle}>Pick up your first course</Text>
          <Button
            size="sm"
            onPress={() => router.push(`/course/${startHere.course_id}`)}
          >
            Start
          </Button>
        </Card>
      ) : null}

      <Card style={styles.dailyCard}>
        <Text style={styles.dailyTitle}>Today's goal</Text>
        <Text style={styles.dailyMeta}>
          {dailyDone} / {DAILY_LESSON_GOAL} lessons completed today
        </Text>
        <ProgressBar
          value={Math.min(1, dailyDone / DAILY_LESSON_GOAL)}
          color={colors.accent}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <View style={styles.grid}>
        <Card style={[styles.statCard, styles.statWide]}>
          <View style={styles.ringRow}>
            <CircularProgressRing value={overallPct} label={overallLabel} />
            <View style={styles.ringMeta}>
              <Text style={styles.statLabel}>Overall progress</Text>
              <Text style={styles.ringHint}>Across all paths</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statValue}>
            {lessonsDone}/{lessonsTotal}
          </Text>
          <ProgressBar
            value={lessonsTotal > 0 ? lessonsDone / lessonsTotal : 0}
            color={colors.accent}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.statLabel}>Lessons done</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{streak} 🔥</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </Card>

        <Card style={styles.statCard}>
          <HeartBar hearts={hearts} maxHearts={maxHearts} />
          <Text style={[styles.statLabel, { marginTop: spacing.sm }]}>Hearts</Text>
        </Card>
      </View>

      <Text style={styles.sectionHeading}>Recent activity</Text>
      {activityQuery.isPending ? (
        <Skeleton width="100%" height={48} style={{ marginBottom: spacing.sm }} />
      ) : recent.length === 0 ? (
        <Text style={styles.emptyActivity}>Complete a lesson to see activity here.</Text>
      ) : (
        recent.map((item, i) => (
          <Pressable
            key={`${item.type}-${i}-${item.timestamp}`}
            style={styles.activityRow}
            onPress={() => {
              if (item.type === "lesson" && item.lesson_id != null) {
                router.push(`/lesson/${item.lesson_id}`);
              } else if (item.course_id != null) {
                router.push(`/course/${item.course_id}`);
              }
            }}
          >
            <Text style={styles.activityTitle} numberOfLines={1}>
              {item.title ?? item.name ?? item.type}
            </Text>
            {item.course ? (
              <Text style={styles.activitySub} numberOfLines={1}>
                {item.course}
              </Text>
            ) : null}
            {item.timestamp ? (
              <Text style={styles.activityTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            ) : null}
          </Pressable>
        ))
      )}

      <Card style={styles.mascotCard}>
        <View style={styles.mascotRow}>
          <MascotImage mascot={mascot} size={64} />
          <View style={styles.bubble}>
            <Text style={styles.mascotText}>{message}</Text>
          </View>
        </View>
      </Card>

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
    backgroundColor: colors.bg,
  },
  greeting: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xl,
  },
  resumeCard: {
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    borderColor: colors.primaryDark,
  },
  resumeLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  resumeTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.white,
    marginBottom: spacing.md,
  },
  dailyCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceOffset,
  },
  dailyTitle: {
    fontSize: typography.sm,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dailyMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
  },
  statWide: {
    width: "100%",
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  ringMeta: { flex: 1 },
  ringHint: { fontSize: typography.xs, color: colors.textMuted, marginTop: 4 },
  statValue: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeading: {
    fontSize: typography.md,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  emptyActivity: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  activityRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  activityTitle: {
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
  },
  activitySub: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityTime: {
    fontSize: typography.xs,
    color: colors.textFaint,
    marginTop: spacing.xs,
  },
  mascotCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  mascotRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  mascotText: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },
});
