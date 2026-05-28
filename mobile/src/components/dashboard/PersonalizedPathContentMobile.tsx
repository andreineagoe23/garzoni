import { useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Skeleton } from "../ui";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  buildProgressByCourse,
  derivePersonalizedPathState,
  fetchCoachBrief,
  getCourseMetrics,
  fetchPersonalizedPath,
  fetchProfile,
  fetchProgressSummary,
  fetchQuestionnaireProgress,
  postPersonalizedPathRefresh,
  queryKeys,
  masteryLevelLabel,
  shouldAutoRefreshEmptyPath,
  staleTimes,
  type PersonalizedPathCourse,
  type ProgressSummary,
  type UserProfile,
} from "@garzoni/core";
import { href } from "../../navigation/href";
import { navigateToExercisesFromDashboardSkill } from "../../hooks/useDashboardSkillExercisesNavigation";
import { useAuthSession } from "../../auth/AuthContext";
import { useThemeColors } from "../../theme/ThemeContext";
import { scheduleStreakReminder } from "../../streak/streakReminder";

/** Normalize onboarding goal tags from API (string or nested arrays) for display. */
function formatOnboardingGoalsLine(goals: unknown): string {
  const list = Array.isArray(goals) ? goals : [];
  const parts: string[] = [];
  for (const item of list) {
    if (typeof item === "string" && item.trim()) {
      parts.push(item.trim());
    } else if (Array.isArray(item)) {
      const inner = item
        .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "")))
        .filter(Boolean);
      if (inner.length) parts.push(inner.join(", "));
    }
  }
  return parts.join(" • ");
}

import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import CircularProgressRing from "../ui/CircularProgressRing";
import { spacing, typography, radius } from "../../theme/tokens";

function courseIconName(pathTitle?: string) {
  const title = String(pathTitle || "").toLowerCase();
  if (title.includes("budget") || title.includes("saving"))
    return "target" as const;
  if (
    title.includes("invest") ||
    title.includes("stock") ||
    title.includes("crypto")
  )
    return "chart-line" as const;
  if (title.includes("debt") || title.includes("credit"))
    return "flash" as const;
  if (title.includes("mindset")) return "lightbulb-on-outline" as const;
  return "book-open-variant" as const;
}

type Props = {
  onCourseClick?: (courseId: number, pathId?: number) => void;
};

export default function PersonalizedPathContentMobile({
  onCourseClick,
}: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    enabled: isAuthenticated,
    staleTime: staleTimes.profile,
  });

  const profilePayload = profileQuery.data;

  // Reschedule (or cancel) the local "don't break your streak" reminder every
  // time the profile refetches — lesson completion invalidates the profile
  // query, so this re-runs after every lesson and keeps the 8pm reminder in
  // sync with the current streak value.
  useEffect(() => {
    const streak = profilePayload?.streak;
    if (typeof streak === "number") {
      void scheduleStreakReminder(streak);
    }
  }, [profilePayload?.streak]);

  const questionnaireQuery = useQuery({
    queryKey: queryKeys.questionnaireProgress(),
    queryFn: fetchQuestionnaireProgress,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const questionnaireCompleted =
    Boolean(
      profilePayload?.is_questionnaire_completed ??
      (
        profilePayload?.user_data as
          | { is_questionnaire_completed?: boolean }
          | undefined
      )?.is_questionnaire_completed ??
      false,
    ) || questionnaireQuery.data?.status === "completed";

  const personalizedQuery = useQuery({
    queryKey: queryKeys.personalizedPath(),
    queryFn: () => fetchPersonalizedPath().then((r) => r.data),
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: 60_000,
  });

  const progressSummaryQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () =>
      fetchProgressSummary().then((r) => r.data as ProgressSummary),
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: staleTimes.progressSummary,
    refetchInterval: 20_000,
  });

  const refreshMutation = useMutation({
    mutationFn: async (_opts?: { silent?: boolean }) =>
      postPersonalizedPathRefresh(),
    onSuccess: async (_data, variables) => {
      await personalizedQuery.refetch();
      if (!variables?.silent) {
        Alert.alert("", t("personalizedPath.refreshed"));
      }
    },
    onError: () => {
      Alert.alert("", t("personalizedPath.errors.recommendationsFailed"));
    },
  });
  const autoRefreshTriggered = useRef(false);
  const coachBriefQuery = useQuery({
    queryKey: ["coachBrief"],
    queryFn: () => fetchCoachBrief().then((r) => r.data),
    enabled: isAuthenticated && questionnaireCompleted,
    staleTime: 86_400_000,
    retry: false,
  });

  const progressByCourse = useMemo(
    () => buildProgressByCourse(progressSummaryQuery.data),
    [progressSummaryQuery.data],
  );

  const { courses, heroCourse, restCourses, reviewQueue, isPreview } = useMemo(
    () => derivePersonalizedPathState(personalizedQuery.data),
    [personalizedQuery.data],
  );

  useEffect(() => {
    if (
      !shouldAutoRefreshEmptyPath({
        questionnaireCompleted,
        personalizedFetchSucceeded: personalizedQuery.isSuccess,
        coursesLength: courses.length,
        isRefreshing: refreshMutation.isPending,
        alreadyTriggered: autoRefreshTriggered.current,
      })
    ) {
      return;
    }
    autoRefreshTriggered.current = true;
    refreshMutation.mutate({ silent: true });
  }, [
    courses.length,
    personalizedQuery.isSuccess,
    questionnaireCompleted,
    refreshMutation,
  ]);

  const openCourse = (course: PersonalizedPathCourse) => {
    if (course.locked) {
      router.push(href("/subscriptions?reason=personalized_path"));
      return;
    }
    if (onCourseClick) {
      onCourseClick(course.id, Number(course.path || 0) || undefined);
    } else {
      router.push(`/flow/${course.id}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <GlassCard padding="md" style={{ gap: spacing.md }}>
        <Text style={{ color: c.textMuted }}>Sign in to view your path.</Text>
        <GlassButton
          variant="primary"
          size="sm"
          onPress={() => router.push(href("/(auth)/login"))}
        >
          Sign in
        </GlassButton>
      </GlassCard>
    );
  }

  if (
    profileQuery.isPending ||
    (questionnaireCompleted && personalizedQuery.isPending)
  ) {
    return (
      <View style={{ gap: spacing.md }}>
        <Skeleton width="100%" height={200} borderRadius={radius.lg} />
        <Skeleton width="100%" height={110} borderRadius={radius.lg} />
        <Skeleton width="100%" height={110} borderRadius={radius.lg} />
        <Skeleton width="100%" height={110} borderRadius={radius.lg} />
      </View>
    );
  }

  if (!questionnaireCompleted) {
    return (
      <GlassCard padding="md">
        <Text style={{ color: c.textMuted }}>
          {t("dashboard.nav.completeOnboarding")}
        </Text>
        <GlassButton
          variant="primary"
          size="sm"
          onPress={() =>
            router.push(href("/onboarding?reason=personalized_path"))
          }
        >
          {t("onboarding.reminderBanner.start")}
        </GlassButton>
      </GlassCard>
    );
  }

  if (personalizedQuery.isError) {
    return (
      <GlassCard padding="md">
        <Text style={{ color: c.error }}>
          {t("personalizedPath.errors.recommendationsFailed")}
        </Text>
      </GlassCard>
    );
  }

  if (!heroCourse && !refreshMutation.isPending) {
    return (
      <GlassCard padding="md" style={{ gap: spacing.md }}>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          {t("personalizedPath.title")}
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          {t("personalizedPath.buildingPath")}
        </Text>
        <GlassButton
          variant="primary"
          size="sm"
          loading={refreshMutation.isPending}
          onPress={() => refreshMutation.mutate(undefined)}
        >
          {t("personalizedPath.refresh")}
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {coachBriefQuery.data?.brief ? (
        <GlassCard padding="md" style={{ gap: spacing.xs }}>
          <Text style={[styles.kicker, { color: c.primary }]}>
            {t("coachBrief.title", "Your Weekly Coach Brief")}
          </Text>
          <Text style={[styles.reason, { color: c.text }]}>
            {coachBriefQuery.data.brief}
          </Text>
        </GlassCard>
      ) : null}
      {heroCourse ? (
        <GlassCard padding="lg" style={{ borderColor: `${c.primary}33` }}>
          {(() => {
            const metrics = getCourseMetrics(heroCourse, progressByCourse);
            return (
              <View style={{ gap: spacing.md, position: "relative" }}>
                <View
                  style={[styles.heroHead, { borderBottomColor: c.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroTitle, { color: c.text }]}>
                      {t("personalizedPath.title")}
                    </Text>
                    <Text style={[styles.heroSub, { color: c.textMuted }]}>
                      {formatOnboardingGoalsLine(
                        personalizedQuery.data?.meta?.onboarding_goals,
                      )}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                    <Text style={[styles.heroSub, { color: c.textMuted }]}>
                      {t("personalizedPath.overallCompletion", {
                        value:
                          personalizedQuery.data?.meta?.overall_completion ?? 0,
                      })}
                    </Text>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      loading={refreshMutation.isPending}
                      onPress={() => refreshMutation.mutate(undefined)}
                    >
                      {refreshMutation.isPending
                        ? t("personalizedPath.refreshing")
                        : t("personalizedPath.refresh")}
                    </GlassButton>
                  </View>
                </View>
                <Text style={[styles.kicker, { color: c.textMuted }]}>
                  {t("personalizedPath.continue")}
                </Text>
                <Text style={[styles.courseTitle, { color: c.text }]}>
                  {heroCourse.title}
                </Text>
                <Text style={[styles.reason, { color: c.textMuted }]}>
                  {heroCourse.reason}
                </Text>
                <View style={styles.heroMetaRow}>
                  <View
                    style={[styles.pill, { backgroundColor: `${c.primary}22` }]}
                  >
                    <MaterialCommunityIcons
                      name={courseIconName(heroCourse.path_title)}
                      size={14}
                      color={c.primary}
                    />
                    <Text style={[styles.pillText, { color: c.primary }]}>
                      {heroCourse.path_title || t("personalizedPath.pathLabel")}
                    </Text>
                  </View>
                  <Text style={[styles.heroSub, { color: c.textMuted }]}>
                    {t("personalizedPath.eta", {
                      minutes: metrics.estimatedMinutes,
                    })}
                  </Text>
                </View>
                <View style={styles.heroActions}>
                  <CircularProgressRing
                    value={metrics.percent / 100}
                    size={44}
                    strokeWidth={4}
                    trackColor={c.border}
                    activeColor={c.primary}
                    label=""
                  />
                  <View style={{ flex: 1 }}>
                    {metrics.totalSections > 0 ? (
                      <Text style={[styles.heroSub, { color: c.textMuted }]}>
                        {metrics.completedSections}/{metrics.totalSections}{" "}
                        sections
                      </Text>
                    ) : (
                      <Text style={[styles.heroSub, { color: c.textMuted }]}>
                        {metrics.completedLessons}/{metrics.totalLessons}{" "}
                        lessons
                      </Text>
                    )}
                  </View>
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onPress={() => openCourse(heroCourse)}
                  >
                    {heroCourse.locked
                      ? t("personalizedPath.unlock")
                      : t("personalizedPath.open")}
                  </GlassButton>
                </View>
                {heroCourse.locked ? (
                  <View
                    style={[
                      styles.lockedOverlay,
                      { backgroundColor: `${c.bg}99` },
                    ]}
                  >
                    <Text style={[styles.lockedLabel, { color: c.primary }]}>
                      {t("personalizedPath.locked")}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })()}
        </GlassCard>
      ) : (
        <GlassCard padding="md">
          <Text style={[styles.heroTitle, { color: c.text }]}>
            {t("personalizedPath.title")}
          </Text>
          <Text style={[styles.heroSub, { color: c.textMuted }]}>
            {formatOnboardingGoalsLine(
              personalizedQuery.data?.meta?.onboarding_goals,
            )}
          </Text>
        </GlassCard>
      )}

      <Text style={[styles.sectionH, { color: c.text }]}>
        {t("personalizedPath.recommendedForYou")}
      </Text>
      {restCourses.map((course, index) => {
        const metrics = getCourseMetrics(course, progressByCourse);
        const percent = metrics.percent;
        const focusHint =
          percent < 30
            ? "Focus on first two sections to build momentum."
            : percent < 70
              ? "You are midway - complete remaining sections to unlock mastery."
              : "Almost done - finish the last section and review queue.";
        const starterTasks = Array.isArray(course.starter_tasks)
          ? course.starter_tasks.slice(0, 2)
          : [];
        return (
          <View key={course.id} style={styles.timelineRow}>
            <View style={styles.timelineCol}>
              {index < restCourses.length - 1 ? (
                <View
                  style={[styles.timelineLine, { backgroundColor: c.border }]}
                />
              ) : null}
              <View
                style={[styles.timelineDot, { borderColor: `${c.primary}55` }]}
              >
                <MaterialCommunityIcons
                  name={courseIconName(course.path_title)}
                  size={14}
                  color={c.primary}
                />
              </View>
            </View>
            <GlassCard padding="md" style={{ flex: 1, borderColor: c.border }}>
              <View style={styles.restHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pathTitle, { color: c.textMuted }]}>
                    {course.path_title}
                  </Text>
                  <Text style={[styles.courseTitle, { color: c.text }]}>
                    {course.title}
                  </Text>
                  <Text style={[styles.reason, { color: c.textMuted }]}>
                    {course.reason}
                  </Text>
                  <Text style={[styles.focusHint, { color: c.textMuted }]}>
                    {focusHint}
                  </Text>
                  <Text
                    style={[
                      styles.heroSub,
                      { color: c.textMuted, marginTop: spacing.sm },
                    ]}
                  >
                    {metrics.totalSections > 0
                      ? t("personalizedPath.progressSectionsLessons", {
                          completedSections: metrics.completedSections,
                          totalSections: metrics.totalSections,
                          completedLessons: metrics.completedLessons,
                          totalLessons: metrics.totalLessons,
                        })
                      : t("personalizedPath.progressLessonsOnly", {
                          completedLessons: metrics.completedLessons,
                          totalLessons: metrics.totalLessons,
                        })}
                  </Text>
                  {course.next_lesson_title ? (
                    <Text style={[styles.nextLesson, { color: c.primary }]}>
                      {t("personalizedPath.nextLesson", {
                        title: course.next_lesson_title,
                      })}
                    </Text>
                  ) : null}
                  {!course.next_lesson_title && starterTasks.length > 0 ? (
                    <View style={{ marginTop: spacing.xs }}>
                      {starterTasks.map((task, taskIdx) => (
                        <Text
                          key={`${course.id}-t-${taskIdx}`}
                          style={[styles.heroSub, { color: c.textMuted }]}
                        >
                          • {task}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <CircularProgressRing
                  value={percent / 100}
                  size={40}
                  strokeWidth={3}
                  trackColor={c.border}
                  activeColor={c.primary}
                  label=""
                />
              </View>
              <View style={styles.restFooter}>
                <Text style={[styles.heroSub, { color: c.textMuted }]}>
                  {t("personalizedPath.eta", {
                    minutes: metrics.estimatedMinutes,
                  })}
                </Text>
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onPress={() => openCourse(course)}
                >
                  {course.locked
                    ? t("personalizedPath.unlock")
                    : t("personalizedPath.open")}
                </GlassButton>
              </View>
              {course.locked ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    { backgroundColor: `${c.bg}88` },
                  ]}
                />
              ) : null}
            </GlassCard>
          </View>
        );
      })}

      <Text style={[styles.sectionH, { color: c.text }]}>
        {t("personalizedPath.skillsToReinforce")}
      </Text>
      {reviewQueue.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
          {t("personalizedPath.noSkillsDue")}
        </Text>
      ) : (
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          {reviewQueue.map((item, idx) => {
            const pct = item.proficiency ?? 0;
            const band = item.level_band ?? "not_started";
            const label = masteryLevelLabel(t, band);
            const dueAt = item.due_at ? new Date(item.due_at) : null;
            const now = new Date();
            const daysUntil = dueAt
              ? Math.ceil((dueAt.getTime() - now.getTime()) / 86400000)
              : 0;
            const dueLabel =
              !dueAt || dueAt <= now
                ? t("personalizedPath.due.now")
                : daysUntil === 1
                  ? t("personalizedPath.due.tomorrow")
                  : t("personalizedPath.due.inDays", { count: daysUntil });

            const bandColor: Record<string, string> = {
              not_started: c.textMuted,
              attempted: c.accent,
              familiar: "#3b82f6",
              proficient: c.primary,
              mastered: c.success,
            };
            const bandBg: Record<string, string> = {
              not_started: "rgba(100,116,139,0.15)",
              attempted: "rgba(255,215,0,0.15)",
              familiar: "rgba(59,130,246,0.15)",
              proficient: `${c.primary}22`,
              mastered: c.successBg,
            };

            return (
              <Pressable
                key={`${item.skill || "s"}-${idx}`}
                onPress={() =>
                  navigateToExercisesFromDashboardSkill(
                    item.skill ?? "",
                    "weak_skill_practice",
                  )
                }
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                  width: "48%",
                  backgroundColor: c.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  gap: spacing.sm,
                })}
              >
                {/* Ring + % */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <CircularProgressRing
                    value={Math.max(0.12, pct / 100)}
                    size={44}
                    strokeWidth={5}
                    activeColor={bandColor[band] ?? c.primary}
                  />
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: bandBg[band] ?? "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: bandColor[band] ?? c.text,
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                </View>

                {/* Skill name */}
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: "700",
                    color: c.text,
                  }}
                  numberOfLines={2}
                >
                  {item.skill}
                </Text>

                {/* Due */}
                <Text style={{ fontSize: 10, color: c.textMuted }}>
                  {dueLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isPreview && personalizedQuery.data?.upgrade_prompt ? (
        <GlassCard padding="md" style={{ alignItems: "center" }}>
          <Text
            style={[styles.reason, { color: c.textMuted, textAlign: "center" }]}
          >
            {personalizedQuery.data.upgrade_prompt}
          </Text>
          <GlassButton
            variant="primary"
            size="sm"
            onPress={() =>
              router.push(href("/subscriptions?reason=personalized_path"))
            }
          >
            {t("personalizedPath.upgrade")}
          </GlassButton>
        </GlassCard>
      ) : null}

      <GlassCard padding="md">
        <Text
          style={[styles.reason, { color: c.textMuted, textAlign: "center" }]}
        >
          {t("personalizedPath.basedOnOnboarding")}{" "}
          <Text
            onPress={() =>
              router.push(href("/onboarding?reason=personalized_path"))
            }
            style={{ color: c.primary, fontWeight: "700" }}
          >
            {t("personalizedPath.updatePreferences")}
          </Text>
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  skel: { height: 120, borderRadius: radius.lg },
  heroHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroTitle: { fontSize: typography.sm, fontWeight: "800" },
  heroSub: { fontSize: typography.xs, marginTop: 4, lineHeight: 16 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  courseTitle: { fontSize: typography.md, fontWeight: "800" },
  reason: { fontSize: typography.xs, marginTop: spacing.xs, lineHeight: 18 },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
  },
  pillText: { fontSize: typography.xs, fontWeight: "600" },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  lockedLabel: { fontSize: typography.xs, fontWeight: "800" },
  sectionH: {
    fontSize: typography.sm,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineCol: { width: 28, alignItems: "center" },
  timelineLine: {
    position: "absolute",
    top: 28,
    bottom: 0,
    width: 2,
    left: 13,
  },
  timelineDot: {
    marginTop: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  restHead: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  pathTitle: { fontSize: typography.xs },
  focusHint: { fontSize: typography.xs, marginTop: spacing.sm, lineHeight: 16 },
  nextLesson: {
    fontSize: typography.xs,
    marginTop: spacing.xs,
    fontWeight: "600",
  },
  restFooter: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
