import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useHearts,
  queryKeys,
  staleTimes,
  fetchProfile,
  type MascotSituation,
  type MascotType,
} from "@garzoni/core";
import ConfettiCannon from "react-native-confetti-cannon";
import { Button, ErrorState, HeartBar, ProgressBar } from "../components/ui";
import MascotWithMessage from "../components/common/MascotWithMessage";
import TextSection from "../components/lesson/TextSection";
import VideoSection from "../components/lesson/VideoSection";
import ExerciseSection from "../components/lesson/ExerciseSection";
import { useLessonFlow, type FlowItem } from "./useLessonFlow";
import { spacing, typography, radius, shadows } from "../theme/tokens";
import { useShowHeartsMobile } from "../hooks/useShowHeartsMobile";
import { useThemeColors } from "../theme/ThemeContext";
import type { ThemeColors } from "../theme/palettes";
import { useTranslation } from "react-i18next";

const LESSON_FONT_SCALE_KEY = "garzoni:lesson_font_scale";

function isExerciseItem(item: FlowItem | null): boolean {
  if (!item || item.kind !== "section") return false;
  const s = item.section;
  return s.content_type === "exercise" || Boolean(s.exercise_type);
}

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function createLessonFlowStyles(c: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.bg },
    centered: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxxl,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: 120,
    },
    sectionTitle: {
      fontSize: typography.lg,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.lg,
    },
    noContent: {
      fontSize: typography.base,
      color: c.textMuted,
      textAlign: "center",
      marginTop: spacing.xxxxl,
    },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      backgroundColor: c.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    bottomBarBack: {
      flexShrink: 0,
      maxWidth: "32%",
    },
    bottomBarBackText: {
      fontSize: typography.sm,
      fontWeight: "700",
      color: c.text,
    },
    midNav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    midLink: {
      fontSize: typography.xs,
      fontWeight: "600",
      color: c.accent,
    },
    midSep: { color: c.textFaint, fontSize: typography.sm },
    contentHeader: {
      marginBottom: spacing.lg,
    },
    courseLabel: {
      fontSize: typography.xs,
      fontWeight: "600",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    stepTitle: {
      fontSize: typography.xl,
      fontWeight: "700",
      color: c.text,
      marginTop: spacing.xs,
    },
    heartsRow: {
      marginTop: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stepFoot: {
      fontSize: typography.xs,
      color: c.textMuted,
      marginTop: spacing.sm,
    },
    continueBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      minWidth: 96,
      alignItems: "center",
    },
    continueBtnText: {
      fontSize: typography.sm,
      fontWeight: "700",
      color: c.textOnPrimary,
    },
    continueBtnDisabled: { opacity: 0.45 },

    completeEmoji: { fontSize: 72, marginBottom: spacing.lg },
    completeTitle: {
      fontSize: typography.xxl,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.sm,
    },
    completeSubtitle: {
      fontSize: typography.base,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: spacing.xxl,
    },
    completeActions: { gap: spacing.md, width: "100%" },

    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
    },
    modalCard: {
      backgroundColor: c.surface,
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
      color: c.text,
      marginBottom: spacing.sm,
    },
    modalMessage: {
      fontSize: typography.base,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    modalActions: { width: "100%", gap: spacing.sm },
  });
}

export type LessonFlowScreenProps = {
  courseId: number;
  headerTitle: string;
  rotationKey: number;
};

export default function LessonFlowScreen({
  courseId,
  headerTitle,
  rotationKey,
}: LessonFlowScreenProps) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const confettiRef = useRef<ConfettiCannon>(null);

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
    completeSectionMutation,
    completeLessonMutation,
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
  const [fontScale, setFontScale] = useState(1);
  const [readingSettingsOpen, setReadingSettingsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [transientLessonSituation, setTransientLessonSituation] =
    useState<MascotSituation | null>(null);
  const transientLessonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearTransientLessonMascot = useCallback(() => {
    if (transientLessonTimerRef.current) {
      clearTimeout(transientLessonTimerRef.current);
      transientLessonTimerRef.current = null;
    }
    setTransientLessonSituation(null);
  }, []);

  const stableLessonMascot = useMemo<MascotType>(() => {
    const lid = currentItem?.lessonId;
    if (!lid) return "bear";
    const n = Math.abs(Math.floor(Number(lid)));
    const idx = n % 3;
    return idx === 0 ? "owl" : idx === 1 ? "bull" : "bear";
  }, [currentItem?.lessonId]);

  const baseLessonMascotSituation = useMemo((): MascotSituation => {
    if (courseComplete) return "lesson_course_completed";
    if (!currentItem) return "lesson_reading";
    if (isExerciseItem(currentItem)) return "lesson_exercise_neutral";
    return "lesson_reading";
  }, [courseComplete, currentItem]);

  const displayLessonSituation =
    transientLessonSituation ?? baseLessonMascotSituation;

  useEffect(() => {
    clearTransientLessonMascot();
  }, [currentIndex, clearTransientLessonMascot]);

  useEffect(() => {
    return () => {
      clearTransientLessonMascot();
    };
  }, [clearTransientLessonMascot]);

  useEffect(() => {
    void AsyncStorage.getItem(LESSON_FONT_SCALE_KEY).then((raw) => {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0.9 && n <= 1.4) setFontScale(n);
    });
  }, []);

  const persistFontScale = useCallback((next: number) => {
    setFontScale(next);
    void AsyncStorage.setItem(LESSON_FONT_SCALE_KEY, String(next));
  }, []);

  useEffect(() => {
    if (outOfHeartsUntilTs && outOfHeartsUntilTs > Date.now()) {
      setOutOfHeartsVisible(true);
    }
  }, [outOfHeartsUntilTs]);

  useEffect(() => {
    if (courseComplete) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.progressSummary(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentActivity(),
      });
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
      if (transientLessonTimerRef.current) {
        clearTimeout(transientLessonTimerRef.current);
        transientLessonTimerRef.current = null;
      }
      setTransientLessonSituation(
        correct ? "lesson_exercise_correct" : "lesson_exercise_incorrect",
      );
      transientLessonTimerRef.current = setTimeout(() => {
        setTransientLessonSituation(null);
        transientLessonTimerRef.current = null;
      }, 3500);
      if (!correct) {
        decrementHeart();
      }
    },
    [decrementHeart],
  );

  const onExerciseComplete = useCallback(async () => {
    await handleCompleteCurrent();
    goNext();
  }, [handleCompleteCurrent, goNext]);

  const stepHeading = useMemo(() => {
    if (!currentItem) return "";
    if (currentItem.kind === "lesson-text") {
      return currentItem.lessonTitle?.trim() ?? "";
    }
    const s = currentItem.section;
    return (s.title || currentItem.lessonTitle || "").trim();
  }, [currentItem]);

  const continueBusy =
    completeSectionMutation.isPending || completeLessonMutation.isPending;

  const handleContinuePress = useCallback(async () => {
    if (!currentItem || continueBusy) return;
    if (isExerciseItem(currentItem)) {
      goNext();
      return;
    }
    if (!currentItem.isCompleted) {
      await handleCompleteCurrent();
    }
    goNext();
  }, [currentItem, continueBusy, handleCompleteCurrent, goNext]);

  const themeColors = useThemeColors();
  const styles = useMemo(
    () => createLessonFlowStyles(themeColors),
    [themeColors],
  );

  if (lessonsQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState
          message={t("courses.flow.loadError")}
          onRetry={() => void lessonsQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (courseComplete) {
    const pts = profileQuery.data?.points;
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.centered]}
        edges={["top", "left", "right", "bottom"]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: -10, y: 0 }}
          fadeOut
          autoStart={false}
        />
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>{t("flow.courseComplete")}</Text>
        <Text style={styles.completeSubtitle}>
          {typeof pts === "number"
            ? `You have ${pts} total XP.`
            : t("flow.courseCompleteSubtitle")}
        </Text>
        <View style={styles.completeActions}>
          <Button onPress={() => router.push(`/quiz/${courseId}`)}>
            {t("flow.takeQuiz")}
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(tabs)")}>
            {t("flow.backToDashboard")}
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.replace("/(tabs)/learn")}
          >
            {t("flow.backToCourses")}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const stepPosition = totalSteps > 0 ? (currentIndex + 1) / totalSteps : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          opacity: immersive ? 0 : 1,
        }}
      >
        <Pressable onPress={() => setReadingSettingsOpen(true)} hitSlop={8}>
          <Text style={{ color: themeColors.accent, fontWeight: "800" }}>
            Aa
          </Text>
        </Pressable>
        <Pressable onPress={() => setImmersive((v) => !v)} hitSlop={8}>
          <Text style={{ color: themeColors.textMuted, fontWeight: "700" }}>
            {immersive ? "UI" : "Focus"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xl + 56 },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View
          style={[
            styles.contentHeader,
            immersive && {
              opacity: 0,
              height: 0,
              overflow: "hidden",
              marginBottom: 0,
            },
          ]}
        >
          <Text style={styles.courseLabel} numberOfLines={1}>
            {headerTitle}
          </Text>
          {stepHeading ? (
            <Text style={styles.stepTitle} numberOfLines={3}>
              {stepHeading}
            </Text>
          ) : null}
          <Text style={[styles.stepFoot, { marginBottom: spacing.xs }]}>
            Reading {Math.round(stepPosition * 100)}%
          </Text>
          <ProgressBar
            value={stepPosition}
            height={5}
            style={{ marginTop: spacing.xs }}
          />
          <ProgressBar
            value={progress}
            height={4}
            style={{ marginTop: spacing.sm }}
          />
          {showHeartsUi ? (
            <View style={styles.heartsRow}>
              <HeartBar
                hearts={hearts}
                maxHearts={maxHearts}
                countdownLabel={heartCountdown}
              />
            </View>
          ) : null}
          <Text style={styles.stepFoot}>
            {t("shared.progress")}{" "}
            {Math.min(currentIndex + 1, Math.max(totalSteps, 1))} /{" "}
            {Math.max(totalSteps, 1)}
          </Text>
        </View>

        {currentItem ? (
          <FlowItemRenderer
            lessonStyles={styles}
            item={currentItem}
            fontScale={fontScale}
            onAttempt={handleAttempt}
            onExerciseComplete={onExerciseComplete}
          />
        ) : flowItems.length === 0 && !lessonsQuery.isPending ? (
          <Text style={styles.noContent}>
            {t("courses.flow.noLessonContent")}
          </Text>
        ) : null}
        <View style={{ marginTop: spacing.xl }}>
          <MascotWithMessage
            mood="neutral"
            situation={displayLessonSituation}
            fixedMascot={stableLessonMascot}
            rotationKey={rotationKey + currentIndex}
            embedded
          />
        </View>
      </ScrollView>

      {immersive ? (
        <Pressable
          onPress={() => setImmersive(false)}
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom, spacing.md) + 52,
            alignSelf: "center",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            backgroundColor: themeColors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: themeColors.border,
          }}
        >
          <Text style={{ color: themeColors.accent, fontWeight: "700" }}>
            Show controls
          </Text>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, spacing.md),
            opacity: immersive ? 0 : 1,
          },
        ]}
        pointerEvents={immersive ? "none" : "auto"}
      >
        <Pressable
          onPress={() => {
            if (isFirst) {
              router.replace("/(tabs)");
              return;
            }
            goPrev();
          }}
          style={styles.bottomBarBack}
        >
          <Text style={styles.bottomBarBackText} numberOfLines={2}>
            {isFirst ? t("courses.flow.backToDashboard") : t("shared.back")}
          </Text>
        </Pressable>

        <View style={[styles.midNav, { flex: 1, justifyContent: "center" }]}>
          <Pressable onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.midLink}>{t("nav.dashboard")}</Text>
          </Pressable>
          <Text style={styles.midSep}>|</Text>
          <Pressable onPress={() => router.replace("/(tabs)/learn")}>
            <Text style={styles.midLink}>{t("nav.learn")}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void handleContinuePress()}
          disabled={continueBusy || !currentItem}
          style={[
            styles.continueBtn,
            (continueBusy || !currentItem) && styles.continueBtnDisabled,
          ]}
        >
          <Text style={styles.continueBtnText}>
            {isLast ? t("shared.finish") : t("shared.continue")}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={readingSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReadingSettingsOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReadingSettingsOpen(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Reading</Text>
            <Text style={styles.modalMessage}>Text size</Text>
            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={() => persistFontScale(0.95)}
              >
                Small
              </Button>
              <Button variant="secondary" onPress={() => persistFontScale(1)}>
                Default
              </Button>
              <Button variant="secondary" onPress={() => persistFontScale(1.2)}>
                Large
              </Button>
              <Button onPress={() => setReadingSettingsOpen(false)}>
                Done
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={outOfHeartsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOutOfHeartsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>💔</Text>
            <Text style={styles.modalTitle}>
              {t("courses.flow.outOfHeartsModalTitle")}
            </Text>
            <Text style={styles.modalMessage}>
              {heartCountdown
                ? `${t("courses.flow.nextHeartIn")} ${heartCountdown.replace("Next in ", "")}.`
                : t("courses.flow.outOfHeartsModalSubtitle")}
            </Text>
            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={() =>
                  void refillHeartsSafe().then(() =>
                    setOutOfHeartsVisible(false),
                  )
                }
              >
                {t("courses.flow.refillHearts")}
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  setOutOfHeartsVisible(false);
                  router.push("/(tabs)/learn");
                }}
              >
                {t("courses.flow.practiseHeart")}
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
  lessonStyles,
  item,
  fontScale,
  onAttempt,
  onExerciseComplete,
}: {
  lessonStyles: ReturnType<typeof createLessonFlowStyles>;
  item: FlowItem;
  fontScale: number;
  onAttempt: (p: { correct: boolean }) => void;
  onExerciseComplete: () => Promise<void>;
}) {
  if (item.kind === "lesson-text") {
    return (
      <View>
        <TextSection html={item.detailedContent} fontScale={fontScale} />
      </View>
    );
  }

  const section = item.section;

  if (section.content_type === "video" && section.video_url) {
    return (
      <View>
        <VideoSection url={section.video_url} title={section.title} />
      </View>
    );
  }

  if (section.content_type === "exercise" || section.exercise_type) {
    return (
      <View>
        <ExerciseSection
          exerciseType={section.exercise_type}
          exerciseData={section.exercise_data}
          exerciseId={section.id}
          isCompleted={item.isCompleted}
          onAttempt={onAttempt}
          onComplete={onExerciseComplete}
        />
      </View>
    );
  }

  return (
    <View>
      <TextSection
        html={section.text_content}
        fallbackText={section.text_content}
        fontScale={fontScale}
      />
    </View>
  );
}
