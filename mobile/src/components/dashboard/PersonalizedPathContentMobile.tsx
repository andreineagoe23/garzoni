import { useEffect, useMemo, useRef } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  fetchPersonalizedPath,
  fetchProfile,
  fetchProgressSummary,
  fetchQuestionnaireProgress,
  postPersonalizedPathRefresh,
  queryKeys,
  staleTimes,
  type PersonalizedPathCourse,
  type ProgressSummary,
  type UserProfile,
} from "@garzoni/core";
import { href } from "../../navigation/href";
import { useAuthSession } from "../../auth/AuthContext";
import { useThemeColors } from "../../theme/ThemeContext";
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

  const progressByCourse = useMemo(() => {
    const entries = progressSummaryQuery.data?.paths || [];
    const map = new Map<
      number,
      {
        percent: number;
        completedSections: number;
        totalSections: number;
        completedLessons: number;
        totalLessons: number;
      }
    >();
    entries.forEach((entry) => {
      if (entry.course_id) {
        const totalSections = Number(entry.total_sections || 0);
        const completedSections = Number(entry.completed_sections || 0);
        const sectionPercent =
          totalSections > 0
            ? Math.round((completedSections / totalSections) * 100)
            : Number(entry.percent_complete || 0);
        map.set(entry.course_id, {
          percent: sectionPercent,
          completedSections,
          totalSections,
          completedLessons: Number(entry.completed_lessons || 0),
          totalLessons: Number(entry.total_lessons || 0),
        });
      }
    });
    return map;
  }, [progressSummaryQuery.data]);

  const courses = personalizedQuery.data?.courses || [];
  const heroCourse = courses[0];
  const restCourses = courses.slice(1);
  const reviewQueue = personalizedQuery.data?.review_queue || [];
  const isPreview = Boolean(personalizedQuery.data?.meta?.preview);

  useEffect(() => {
    if (!questionnaireCompleted) return;
    if (!personalizedQuery.isSuccess) return;
    if (courses.length > 0) return;
    if (refreshMutation.isPending || autoRefreshTriggered.current) return;
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

  const getCourseMetrics = (course: PersonalizedPathCourse) => {
    const progress = progressByCourse.get(course.id);
    const fallbackCompletedLessons = Number(course.completed_lessons || 0);
    const fallbackTotalLessons = Number(course.total_lessons || 0);
    const completedLessons =
      progress?.completedLessons ?? fallbackCompletedLessons;
    const totalLessons = progress?.totalLessons ?? fallbackTotalLessons;
    const completedSections =
      progress?.completedSections ?? Number(course.completed_sections || 0);
    const totalSections =
      progress?.totalSections ?? Number(course.total_sections || 0);
    const percent =
      progress?.percent ??
      (totalLessons > 0
        ? Math.round((completedLessons / Math.max(totalLessons, 1)) * 100)
        : Number(course.completion_percent || 0));
    const estimatedMinutes =
      Number(course.estimated_minutes || 0) > 0
        ? Number(course.estimated_minutes || 0)
        : Math.max(totalLessons * 4, 8);
    return {
      percent,
      completedLessons,
      totalLessons,
      completedSections,
      totalSections,
      estimatedMinutes,
    };
  };

  if (!isAuthenticated) {
    return (
      <GlassCard padding="md">
        <Text style={{ color: c.textMuted }}>Sign in to view your path.</Text>
      </GlassCard>
    );
  }

  if (
    profileQuery.isPending ||
    (questionnaireCompleted && personalizedQuery.isPending)
  ) {
    return (
      <GlassCard padding="lg" style={{ gap: spacing.md }}>
        <View style={[styles.skel, { backgroundColor: c.border }]} />
        <View
          style={[styles.skel, { height: 100, backgroundColor: c.border }]}
        />
      </GlassCard>
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
      {heroCourse ? (
        <GlassCard padding="lg" style={{ borderColor: `${c.primary}33` }}>
          {(() => {
            const metrics = getCourseMetrics(heroCourse);
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
                      {(
                        personalizedQuery.data?.meta?.onboarding_goals || []
                      ).join(" • ")}
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
                      variant="ghost"
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
            {(personalizedQuery.data?.meta?.onboarding_goals || []).join(" • ")}
          </Text>
        </GlassCard>
      )}

      <Text style={[styles.sectionH, { color: c.text }]}>
        {t("personalizedPath.recommendedForYou")}
      </Text>
      {restCourses.map((course, index) => {
        const metrics = getCourseMetrics(course);
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
                      ? `${metrics.completedSections}/${metrics.totalSections} sections • ${metrics.completedLessons}/${metrics.totalLessons} lessons`
                      : `${metrics.completedLessons}/${metrics.totalLessons} lessons`}
                  </Text>
                  {course.next_lesson_title ? (
                    <Text style={[styles.nextLesson, { color: c.primary }]}>
                      Next: {course.next_lesson_title}
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
                  variant="ghost"
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {reviewQueue.length === 0 ? (
          <GlassCard padding="sm">
            <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
              {t("personalizedPath.noSkillsDue")}
            </Text>
          </GlassCard>
        ) : (
          reviewQueue.map((item, idx) => (
            <GlassCard
              key={`${item.skill || "s"}-${idx}`}
              padding="sm"
              style={{ minWidth: 160 }}
            >
              <Text style={[styles.heroSub, { color: c.textMuted }]}>
                {item.skill}
              </Text>
              <Text style={[styles.courseTitle, { color: c.text }]}>
                {t("personalizedPath.skillScore", {
                  value: item.proficiency ?? 0,
                })}
              </Text>
            </GlassCard>
          ))
        )}
      </ScrollView>

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
