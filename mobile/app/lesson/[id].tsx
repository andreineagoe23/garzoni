import { useMemo } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { lessonService, staleTimes } from "@garzoni/core";
import { ErrorState, Skeleton } from "../../src/components/ui";
import LessonFlowScreen from "../../src/lesson/LessonFlowScreen";
import { parseCourseIdFromLesson } from "../../src/lesson/parseCourseId";
import { spacing } from "../../src/theme/tokens";
import { useThemeColors } from "../../src/theme/ThemeContext";

export default function LessonScreen() {
  const { t } = useTranslation("common");
  const { id, courseId: courseIdParam } = useLocalSearchParams<{
    id: string;
    courseId?: string;
  }>();
  const lessonId = Number(id);
  const fromParam = Number(courseIdParam);
  const courseIdFromParam =
    Number.isFinite(fromParam) && fromParam > 0 ? Math.trunc(fromParam) : 0;

  const lessonQuery = useQuery({
    queryKey: ["lesson", lessonId],
    enabled: Number.isFinite(lessonId),
    queryFn: () =>
      lessonService
        .fetchById(lessonId)
        .then((r) => r.data as Record<string, unknown>),
    staleTime: staleTimes.content,
  });

  const fromLesson = parseCourseIdFromLesson(lessonQuery.data?.course);
  const effectiveCourseId = courseIdFromParam || fromLesson;

  const flowReady =
    effectiveCourseId > 0 && (courseIdFromParam > 0 || lessonQuery.isSuccess);

  const c = useThemeColors();
  const safeAreaStyle = useMemo(
    () => [styles.safeArea, { backgroundColor: c.bg }],
    [c.bg],
  );

  if (!Number.isFinite(lessonId)) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message={t("screenErrors.invalidLesson")}
          onReport={() => router.push("/feedback")}
        />
      </SafeAreaView>
    );
  }

  if (lessonQuery.isPending && !courseIdFromParam) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={8} style={{ marginTop: spacing.lg }} />
          <Skeleton
            width="100%"
            height={200}
            style={{ marginTop: spacing.xxl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (lessonQuery.isError && !courseIdFromParam) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message={t("screenErrors.loadLesson")}
          onRetry={() => void lessonQuery.refetch()}
          onReport={() => router.push("/feedback")}
        />
      </SafeAreaView>
    );
  }

  if (lessonQuery.isSuccess && effectiveCourseId <= 0) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message={t("screenErrors.lessonMissingCourse")}
          onReport={() => router.push("/feedback")}
        />
      </SafeAreaView>
    );
  }

  if (!flowReady) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={8} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle =
    (lessonQuery.data?.title as string | undefined) ?? `Lesson ${id}`;

  return (
    <LessonFlowScreen
      courseId={effectiveCourseId}
      headerTitle={headerTitle}
      rotationKey={lessonId}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { padding: spacing.xl },
});
