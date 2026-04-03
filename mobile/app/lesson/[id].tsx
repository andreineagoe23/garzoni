import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  lessonService,
  useHearts,
  queryKeys,
  staleTimes,
  fetchProfile,
} from "@monevo/core";
import ConfettiCannon from "react-native-confetti-cannon";
import {
  Button,
  ErrorState,
  HeartBar,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import TextSection from "../../src/components/lesson/TextSection";
import VideoSection from "../../src/components/lesson/VideoSection";
import ExerciseSection from "../../src/components/lesson/ExerciseSection";
import { useLessonFlow, type FlowItem } from "../../src/lesson/useLessonFlow";
import { colors, spacing, typography, radius, shadows } from "../../src/theme/tokens";
import { useShowHeartsMobile } from "../../src/hooks/useShowHeartsMobile";

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = Number(id);
  const queryClient = useQueryClient();
  const confettiRef = useRef<ConfettiCannon>(null);

  const lessonQuery = useQuery({
    queryKey: ["lesson", lessonId],
    enabled: Number.isFinite(lessonId),
    queryFn: () =>
      lessonService.fetchById(lessonId).then((r) => r.data as Record<string, unknown>),
    staleTime: staleTimes.content,
  });

  const courseId = Number(lessonQuery.data?.course) || 0;

  const {
    lessonsQuery,
    flowItems,
    currentIndex,
    currentItem,
    isFirst,
    isLast,
    totalSteps,
    completedSteps,
    courseComplete,
    goNext,
    goPrev,
    handleCompleteCurrent,
  } = useLessonFlow(courseId);

  const {
    hearts,
    maxHearts,
    decrementHeart,
    outOfHeartsUntilTs,
    refillHeartsSafe,
    nextHeartInSecondsRaw,
  } = useHearts({ enabled: true, refetchIntervalMs: 30_000 });
  const showHeartsUi = useShowHeartsMobile();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    enabled: courseComplete,
    staleTime: staleTimes.profile,
  });

  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);

  useEffect(() => {
    if (outOfHeartsUntilTs && outOfHeartsUntilTs > Date.now()) {
      setOutOfHeartsVisible(true);
    }
  }, [outOfHeartsUntilTs]);

  useEffect(() => {
    if (courseComplete) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progressSummary() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity() });
      setTimeout(() => confettiRef.current?.start(), 400);
    }
  }, [courseComplete, queryClient]);

  const heartCountdown = useMemo(() => {
    if (
      hearts <= 0 &&
      typeof nextHeartInSecondsRaw === "number" &&
      Number.isFinite(nextHeartInSecondsRaw)
    ) {
      return `Next in ${formatCountdown(nextHeartInSecondsRaw)}`;
    }
    return null;
  }, [hearts, nextHeartInSecondsRaw]);

  const handleAttempt = useCallback(
    ({ correct }: { correct: boolean }) => {
      if (!correct) {
        decrementHeart();
      }
    },
    [decrementHeart]
  );

  const handleSectionComplete = useCallback(async () => {
    await handleCompleteCurrent();
    goNext();
  }, [handleCompleteCurrent, goNext]);

  const lessonTitle =
    (lessonQuery.data?.title as string) ?? `Lesson ${id}`;

  if (!Number.isFinite(lessonId)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState message="Invalid lesson." />
      </SafeAreaView>
    );
  }

  if (lessonQuery.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="100%" height={8} style={{ marginTop: spacing.lg }} />
          <Skeleton width="100%" height={200} style={{ marginTop: spacing.xxl }} />
        </View>
      </SafeAreaView>
    );
  }

  if (lessonQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message="Could not load lesson."
          onRetry={() => void lessonQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (courseComplete) {
    const pts = profileQuery.data?.points;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: -10, y: 0 }}
          fadeOut
          autoStart={false}
        />
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>Course complete!</Text>
        <Text style={styles.completeSubtitle}>
          {typeof pts === "number" ? `You have ${pts} total XP.` : "Great work finishing this course."}
        </Text>
        <View style={styles.completeActions}>
          <Button
            onPress={() =>
              router.push(`/quiz/${courseId}`)
            }
          >
            Take quiz
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(tabs)")}>
            Dashboard
          </Button>
          <Button variant="ghost" onPress={() => router.replace("/(tabs)/learn")}>
            Browse courses
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const canAdvance = Boolean(currentItem?.isCompleted);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {lessonTitle}
          </Text>
          <ProgressBar value={progress} height={4} style={{ marginTop: 4 }} />
        </View>
        {showHeartsUi ? (
          <HeartBar
            hearts={hearts}
            maxHearts={maxHearts}
            countdownLabel={heartCountdown}
          />
        ) : (
          <View style={{ width: 8 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {currentItem ? (
          <FlowItemRenderer
            item={currentItem}
            onAttempt={handleAttempt}
            onComplete={handleSectionComplete}
          />
        ) : flowItems.length === 0 && !lessonsQuery.isPending ? (
          <Text style={styles.noContent}>No lesson content yet.</Text>
        ) : null}
        <View style={{ marginTop: spacing.xl }}>
          <MascotWithMessage mood="encourage" rotationKey={lessonId} />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={goPrev}
          disabled={isFirst}
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
        >
          <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>
            ← Back
          </Text>
        </Pressable>

        <View style={styles.midNav}>
          <Pressable onPress={() => router.replace("/(tabs)/learn")}>
            <Text style={styles.midLink}>Learn</Text>
          </Pressable>
          <Text style={styles.midSep}>|</Text>
          <Pressable
            onPress={() =>
              courseId ? router.push(`/course/${courseId}`) : undefined
            }
          >
            <Text style={styles.midLink}>Course</Text>
          </Pressable>
        </View>

        {canAdvance ? (
          <Pressable onPress={goNext} style={styles.navBtn}>
            <Text style={styles.navBtnText}>
              {isLast ? "Finish" : "Next →"}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.navBtn, styles.navBtnDisabled]} />
        )}
      </View>

      <Text style={styles.stepFoot}>
        Step {Math.min(currentIndex + 1, Math.max(totalSteps, 1))} / {Math.max(totalSteps, 1)}
      </Text>

      <Modal
        visible={outOfHeartsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOutOfHeartsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>💔</Text>
            <Text style={styles.modalTitle}>Out of hearts</Text>
            <Text style={styles.modalMessage}>
              {heartCountdown
                ? `Next free heart in ${heartCountdown.replace("Next in ", "")}.`
                : "Wait for hearts to refill, use a refill if you have one, or keep practicing."}
            </Text>
            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={() => void refillHeartsSafe().then(() => setOutOfHeartsVisible(false))}
              >
                Try refill
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  setOutOfHeartsVisible(false);
                  router.push("/(tabs)/learn");
                }}
              >
                Practice
              </Button>
              <Button onPress={() => setOutOfHeartsVisible(false)}>Wait</Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FlowItemRenderer({
  item,
  onAttempt,
  onComplete,
}: {
  item: FlowItem;
  onAttempt: (p: { correct: boolean }) => void;
  onComplete: () => Promise<void>;
}) {
  if (item.kind === "lesson-text") {
    return (
      <View>
        <Text style={styles.sectionTitle}>{item.lessonTitle}</Text>
        <TextSection html={item.detailedContent} />
        {!item.isCompleted ? (
          <Button
            size="sm"
            onPress={() => void onComplete()}
            style={{ marginTop: spacing.lg }}
          >
            Mark as read
          </Button>
        ) : null}
      </View>
    );
  }

  const section = item.section;

  if (section.content_type === "video" && section.video_url) {
    return (
      <View>
        {section.title ? (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        ) : null}
        <VideoSection url={section.video_url} title={section.title} />
        {!item.isCompleted ? (
          <Button
            size="sm"
            onPress={() => void onComplete()}
            style={{ marginTop: spacing.lg }}
          >
            Mark as watched
          </Button>
        ) : null}
      </View>
    );
  }

  if (section.content_type === "exercise" || section.exercise_type) {
    return (
      <View>
        {section.title ? (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        ) : null}
        <ExerciseSection
          exerciseType={section.exercise_type}
          exerciseData={section.exercise_data}
          exerciseId={section.id}
          isCompleted={item.isCompleted}
          onAttempt={onAttempt}
          onComplete={onComplete}
        />
      </View>
    );
  }

  return (
    <View>
      {section.title ? (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      ) : null}
      <TextSection
        html={section.text_content}
        fallbackText={section.text_content}
      />
      {!item.isCompleted ? (
        <Button
          size="sm"
          onPress={() => void onComplete()}
          style={{ marginTop: spacing.lg }}
        >
          Mark as read
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
  loadingContainer: { padding: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backBtn: { padding: spacing.sm, marginRight: spacing.sm },
  backText: { fontSize: typography.xl, color: colors.primary },
  headerCenter: { flex: 1, marginRight: spacing.md },
  headerTitle: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  noContent: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xxxxl,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  midNav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  midLink: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  midSep: { color: colors.textFaint, fontSize: typography.sm },
  navBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  navBtnTextDisabled: { color: colors.textFaint },
  stepFoot: {
    textAlign: "center",
    fontSize: typography.xs,
    color: colors.textMuted,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },

  completeEmoji: { fontSize: 72, marginBottom: spacing.lg },
  completeTitle: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  completeSubtitle: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
  completeActions: { gap: spacing.md, width: "100%" },

  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: "100%",
    alignItems: "center",
    ...shadows.lg,
  },
  modalEmoji: { fontSize: 56, marginBottom: spacing.lg },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  modalActions: { width: "100%", gap: spacing.sm },
});
