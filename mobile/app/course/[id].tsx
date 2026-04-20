import { useCallback, useMemo } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  courseService,
  fetchLessonsWithProgress,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { unwrapApiList } from "../../src/lib/unwrapApiList";
import {
  Badge,
  Button,
  ErrorState,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import type { ThemeColors } from "../../src/theme/palettes";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../src/theme/tokens";

type LessonRow = {
  id?: number;
  title?: string;
  is_completed?: boolean;
  short_description?: string;
};

function lessonsLoadErrorMessage(
  error: unknown,
  t: TFunction<"common">,
): {
  upgrade: boolean;
  message: string;
} {
  if (!isAxiosError(error)) {
    return { upgrade: false, message: t("screenErrors.loadCourseLessons") };
  }
  const status = error.response?.status;
  const data = error.response?.data as
    | { error?: string; detail?: string }
    | undefined;
  const msg =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.detail === "string" && data.detail) ||
    error.message;
  if (status === 403) {
    return {
      upgrade: true,
      message:
        typeof msg === "string" && msg.trim()
          ? msg
          : t("screenErrors.upgradeRequiredGeneric"),
    };
  }
  return {
    upgrade: false,
    message:
      typeof msg === "string" ? msg : t("screenErrors.loadCourseLessons"),
  };
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);
  const { hydrated } = useAuthSession();
  const c = useThemeColors();
  const styles = useMemo(() => makeCourseStyles(c), [c]);
  const { t } = useTranslation("common");

  const headerRightHome = useCallback(
    () => (
      <Pressable
        onPress={() => router.replace("/(tabs)")}
        hitSlop={12}
        style={{ paddingHorizontal: spacing.sm }}
      >
        <Text
          style={{
            color: c.primary,
            fontWeight: "700",
            fontSize: typography.sm,
          }}
        >
          {t("nav.dashboard")}
        </Text>
      </Pressable>
    ),
    [c.primary, t],
  );

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    enabled: hydrated && Number.isFinite(courseId),
    queryFn: () => courseService.fetchById(courseId).then((r) => r.data),
    staleTime: staleTimes.content,
  });

  const lessonsQuery = useQuery<LessonRow[]>({
    queryKey: queryKeys.lessonsWithProgress(courseId),
    enabled: hydrated && Number.isFinite(courseId),
    queryFn: () =>
      fetchLessonsWithProgress(courseId).then((r) =>
        unwrapApiList<LessonRow>(r.data),
      ),
    staleTime: staleTimes.content,
  });

  const lessons: LessonRow[] = lessonsQuery.data ?? [];
  const completedCount = useMemo(
    () => lessons.filter((l) => l.is_completed).length,
    [lessons],
  );
  const pct = lessons.length > 0 ? completedCount / lessons.length : 0;

  const courseTitle =
    (courseQuery.data as { title?: string })?.title ??
    t("courseDetail.courseFallback", { id });

  const onRefresh = useCallback(() => {
    void courseQuery.refetch();
    void lessonsQuery.refetch();
  }, [courseQuery, lessonsQuery]);

  const firstIncomplete = useMemo(
    () => lessons.find((l) => !l.is_completed),
    [lessons],
  );

  if (!hydrated || lessonsQuery.isPending) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: t("courseDetail.loading"),
            headerRight: headerRightHome,
          }}
        />
        <Skeleton
          width="80%"
          height={28}
          style={{ marginBottom: spacing.md }}
        />
        <Skeleton
          width="100%"
          height={10}
          style={{ marginBottom: spacing.xxl }}
        />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={64}
            style={{ marginBottom: spacing.sm }}
          />
        ))}
      </View>
    );
  }

  if (lessonsQuery.isError) {
    const { upgrade, message } = lessonsLoadErrorMessage(
      lessonsQuery.error,
      t,
    );
    return (
      <>
        <Stack.Screen
          options={{ title: courseTitle, headerRight: headerRightHome }}
        />
        <ErrorState
          message={message}
          onRetry={upgrade ? undefined : () => void lessonsQuery.refetch()}
          actionLabel={upgrade ? t("screenErrors.viewPlans") : undefined}
          onAction={upgrade ? () => router.push("/subscriptions") : undefined}
          onReport={() => router.push("/feedback")}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: courseTitle, headerRight: headerRightHome }}
      />
      <FlatList
        data={lessons}
        keyExtractor={(item, i) => String(item.id ?? i)}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={lessonsQuery.isFetching}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{courseTitle}</Text>
            <Text style={styles.meta}>
              {t("courseDetail.lessonsCompleted", {
                completed: completedCount,
                total: lessons.length,
              })}
            </Text>
            <ProgressBar value={pct} style={{ marginTop: spacing.sm }} />

            {firstIncomplete ? (
              <Button
                style={{ marginTop: spacing.lg }}
                onPress={() => router.push(`/flow/${courseId}`)}
              >
                {pct > 0
                  ? t("courseDetail.continue")
                  : t("courseDetail.startLearning")}
              </Button>
            ) : pct >= 1 ? (
              <Badge
                label={t("courseDetail.completedBadge")}
                color={c.success}
                style={{ marginTop: spacing.lg }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const completed = item.is_completed;
          return (
            <Pressable
              style={styles.lessonRow}
              onPress={() =>
                item.id != null &&
                router.push(`/lesson/${item.id}?courseId=${courseId}`)
              }
            >
              <View
                style={[
                  styles.indexCircle,
                  completed && styles.indexCircleDone,
                ]}
              >
                <Text
                  style={[styles.indexText, completed && styles.indexTextDone]}
                >
                  {completed ? "✓" : index + 1}
                </Text>
              </View>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle} numberOfLines={2}>
                  {item.title ??
                    t("courseDetail.lessonFallback", { id: item.id })}
                </Text>
                {item.short_description ? (
                  <Text style={styles.lessonDesc} numberOfLines={1}>
                    {item.short_description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </>
  );
}

function makeCourseStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: spacing.xl,
      paddingBottom: 60,
      backgroundColor: colors.bg,
    },
    header: { marginBottom: spacing.xxl },
    title: {
      fontSize: typography.xl,
      fontWeight: "700",
      color: colors.text,
    },
    meta: {
      fontSize: typography.sm,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    lessonRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.sm,
    },
    indexCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceOffset,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    indexCircleDone: { backgroundColor: colors.success },
    indexText: {
      fontSize: typography.sm,
      fontWeight: "700",
      color: colors.textMuted,
    },
    indexTextDone: { color: colors.white },
    lessonInfo: { flex: 1 },
    lessonTitle: {
      fontSize: typography.base,
      fontWeight: "600",
      color: colors.text,
    },
    lessonDesc: {
      fontSize: typography.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
}
