import { useCallback, useMemo } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  courseService,
  fetchLessonsWithProgress,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import { colors, spacing, typography, radius, shadows } from "../../src/theme/tokens";

type LessonRow = {
  id?: number;
  title?: string;
  is_completed?: boolean;
  short_description?: string;
};

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    enabled: Number.isFinite(courseId),
    queryFn: () => courseService.fetchById(courseId).then((r) => r.data),
    staleTime: staleTimes.content,
  });

  const lessonsQuery = useQuery({
    queryKey: queryKeys.lessonsWithProgress(courseId),
    enabled: Number.isFinite(courseId),
    queryFn: () =>
      fetchLessonsWithProgress(courseId).then((r) => {
        const raw = r.data;
        if (Array.isArray(raw)) return raw as LessonRow[];
        const results = (raw as { results?: LessonRow[] })?.results;
        return Array.isArray(results) ? results : [];
      }),
    staleTime: staleTimes.content,
  });

  const lessons = lessonsQuery.data ?? [];
  const completedCount = useMemo(
    () => lessons.filter((l) => l.is_completed).length,
    [lessons]
  );
  const pct = lessons.length > 0 ? completedCount / lessons.length : 0;

  const courseTitle = (courseQuery.data as { title?: string })?.title ?? `Course ${id}`;

  const onRefresh = useCallback(() => {
    void courseQuery.refetch();
    void lessonsQuery.refetch();
  }, [courseQuery, lessonsQuery]);

  const firstIncomplete = useMemo(
    () => lessons.find((l) => !l.is_completed),
    [lessons]
  );

  if (lessonsQuery.isPending) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Loading…" }} />
        <Skeleton width="80%" height={28} style={{ marginBottom: spacing.md }} />
        <Skeleton width="100%" height={10} style={{ marginBottom: spacing.xxl }} />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="100%" height={64} style={{ marginBottom: spacing.sm }} />
        ))}
      </View>
    );
  }

  if (lessonsQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ title: courseTitle }} />
        <ErrorState
          message="Could not load lessons."
          onRetry={() => void lessonsQuery.refetch()}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: courseTitle }} />
      <FlatList
        data={lessons}
        keyExtractor={(item, i) => String(item.id ?? i)}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={lessonsQuery.isFetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{courseTitle}</Text>
            <Text style={styles.meta}>
              {completedCount}/{lessons.length} lessons completed
            </Text>
            <ProgressBar value={pct} style={{ marginTop: spacing.sm }} />

            {firstIncomplete ? (
              <Button
                style={{ marginTop: spacing.lg }}
                onPress={() =>
                  firstIncomplete.id != null &&
                  router.push(`/lesson/${firstIncomplete.id}`)
                }
              >
                {pct > 0 ? "Continue" : "Start learning"}
              </Button>
            ) : pct >= 1 ? (
              <Badge
                label="✓ Completed"
                color={colors.success}
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
                item.id != null && router.push(`/lesson/${item.id}`)
              }
            >
              <View style={[styles.indexCircle, completed && styles.indexCircleDone]}>
                <Text style={[styles.indexText, completed && styles.indexTextDone]}>
                  {completed ? "✓" : index + 1}
                </Text>
              </View>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle} numberOfLines={2}>
                  {item.title ?? `Lesson ${item.id}`}
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

const styles = StyleSheet.create({
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
