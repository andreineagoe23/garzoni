import { useMemo } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { courseService, staleTimes } from "@monevo/core";
import { ErrorState, Skeleton } from "../../src/components/ui";
import LessonFlowScreen from "../../src/lesson/LessonFlowScreen";
import { spacing } from "../../src/theme/tokens";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useThemeColors } from "../../src/theme/ThemeContext";

export default function CourseFlowRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const courseId = Number(id);
  const { hydrated } = useAuthSession();
  const c = useThemeColors();

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    enabled: hydrated && Number.isFinite(courseId) && courseId > 0,
    queryFn: () => courseService.fetchById(courseId).then((r) => r.data),
    staleTime: staleTimes.content,
  });

  const safeAreaStyle = useMemo(
    () => [styles.safeArea, { backgroundColor: c.bg }],
    [c.bg]
  );

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState message="Invalid course." />
      </SafeAreaView>
    );
  }

  if (!hydrated || courseQuery.isPending) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton width="70%" height={24} style={{ margin: spacing.xl }} />
        <Skeleton width="100%" height={200} style={{ marginHorizontal: spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (courseQuery.isError) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message="Could not load course."
          onRetry={() => void courseQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const title =
    (courseQuery.data as { title?: string } | undefined)?.title ?? `Course ${id}`;

  return (
    <LessonFlowScreen
      courseId={courseId}
      headerTitle={title}
      rotationKey={courseId}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
