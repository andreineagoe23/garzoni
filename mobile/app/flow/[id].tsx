import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { courseService, staleTimes } from "@garzoni/core";
import { ErrorState, Skeleton } from "../../src/components/ui";
import LessonFlowScreen from "../../src/lesson/LessonFlowScreen";
import { spacing } from "../../src/theme/tokens";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useThemeColors } from "../../src/theme/ThemeContext";

export default function CourseFlowRoute() {
  const { id, lessonId } = useLocalSearchParams<{
    id: string;
    lessonId?: string;
  }>();
  const courseId = Number(id);
  const initialLessonId = useMemo(() => {
    if (!lessonId) return null;
    const parsed = Number(lessonId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [lessonId]);
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
    [c.bg],
  );

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState message="Invalid course." />
      </SafeAreaView>
    );
  }

  // Deliberately does NOT wait on courseQuery. `courseId` is already known from
  // the route params, so gating here delayed LessonFlowScreen's own lessons +
  // flow-state queries behind a metadata fetch whose only use is the header
  // title — one avoidable round trip before lesson content can paint. `title`
  // falls back to `Course ${id}` and swaps in when the query lands; `key` is
  // courseId, not query state, so the late title does not remount the flow.
  if (!hydrated) {
    return (
      <SafeAreaView style={safeAreaStyle}>
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton width="70%" height={24} style={{ margin: spacing.xl }} />
        <Skeleton
          width="100%"
          height={200}
          style={{ marginHorizontal: spacing.xl }}
        />
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
    (courseQuery.data as { title?: string } | undefined)?.title ??
    `Course ${id}`;

  return (
    // key forces a clean remount when advancing to the next path course via
    // router.replace('/flow/<id>') — expo-router reuses the route component,
    // which otherwise carries stale flow state (currentIndex, courseComplete).
    <LessonFlowScreen
      key={courseId}
      courseId={courseId}
      headerTitle={title}
      rotationKey={courseId}
      initialLessonId={initialLessonId}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
