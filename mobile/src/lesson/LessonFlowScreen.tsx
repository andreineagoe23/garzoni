import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
  COURSE_TO_TOOL_CTA,
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
import LessonCheckpointModal, {
  type CheckpointQuizRow,
} from "./LessonCheckpointModal";
import { fetchLessonCheckpointQuizzes } from "@garzoni/core";
import { spacing, typography, radius, shadows } from "../theme/tokens";
import { useShowHeartsMobile } from "../hooks/useShowHeartsMobile";
import { useThemeColors } from "../theme/ThemeContext";
import type { ThemeColors } from "../theme/palettes";
import { useTranslation } from "react-i18next";
import { HeaderChatButton } from "../components/navigation/HeaderChatButton";

const LESSON_FONT_SCALE_KEY = "garzoni:lesson_font_scale";

/** DB `Exercise.id` embedded in lesson section JSON, when the flow should grade via `/exercises/:id/submit/`. */
function catalogExerciseIdFromData(
  data: Record<string, unknown> | undefined | null,
): number | null {
  if (!data || typeof data !== "object") return null;
  const raw =
    data.catalog_exercise_id ??
    data.exercise_id ??
    data.exerciseId ??
    data.linkedExerciseId;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isExerciseItem(
  item: FlowItem | null,
): item is Extract<FlowItem, { kind: "section" }> {
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
  const { width } = useWindowDimensions();
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
    completedIds,
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
  const checkpointResolveRef = useRef<(() => void) | null>(null);
  const checkpointGatePromiseRef = useRef<Promise<void> | null>(null);
  const [checkpointVisible, setCheckpointVisible] = useState(false);
  const [checkpointRows, setCheckpointRows] = useState<CheckpointQuizRow[]>([]);
  const [checkpointBusy, setCheckpointBusy] = useState(false);

  const resolveCheckpointLessonId = useCallback(
    (
      items: FlowItem[],
      index: number,
      item: FlowItem | null,
    ): number | null => {
      if (!item) return null;
      if (item.kind === "lesson-text") {
        return Number.isFinite(item.lessonId) ? item.lessonId : null;
      }
      if (item.kind !== "section") return null;
      const next = items[index + 1];
      if (!next || next.lessonId !== item.lessonId) {
        return Number.isFinite(item.lessonId) ? item.lessonId : null;
      }
      return null;
    },
    [],
  );

  const waitLessonCheckpoint = useCallback(
    (lessonId: number | null) => {
      if (lessonId == null || !Number.isFinite(lessonId)) {
        return Promise.resolve();
      }
      if (checkpointGatePromiseRef.current) {
        return checkpointGatePromiseRef.current;
      }
      setCheckpointBusy(true);
      const p = new Promise<void>((resolve) => {
        void fetchLessonCheckpointQuizzes(lessonId)
          .then((res) => {
            const raw = Array.isArray(res.data) ? res.data : [];
            const rows: CheckpointQuizRow[] = raw
              .map((q: unknown) => {
                const row = q as Record<string, unknown>;
                return {
                  id: Number(row.id),
                  title: String(row.title ?? ""),
                  question: String(row.question ?? ""),
                  choices: (row.choices as { text: string }[]) ?? [],
                  correct_answer: String(row.correct_answer ?? ""),
                  is_completed: Boolean(row.is_completed),
                };
              })
              .filter((q) => Number.isFinite(q.id));
            const pending = rows.filter((q) => !q.is_completed);
            if (pending.length === 0) {
              setCheckpointBusy(false);
              checkpointGatePromiseRef.current = null;
              resolve();
              return;
            }
            const finish = () => {
              setCheckpointBusy(false);
              checkpointGatePromiseRef.current = null;
              resolve();
            };
            checkpointResolveRef.current = finish;
            setCheckpointRows(pending);
            setCheckpointVisible(true);
          })
          .catch(() => {
            setCheckpointBusy(false);
            checkpointGatePromiseRef.current = null;
            Alert.alert(
              t("courses.flow.checkpointLoadTitle"),
              t("courses.flow.checkpointLoadFailed"),
            );
            resolve();
          });
      });
      checkpointGatePromiseRef.current = p;
      return p;
    },
    [t],
  );

  const finishCheckpointModal = useCallback(() => {
    setCheckpointVisible(false);
    setCheckpointRows([]);
    const r = checkpointResolveRef.current;
    checkpointResolveRef.current = null;
    r?.();
  }, []);

  useEffect(() => {
    return () => {
      const r = checkpointResolveRef.current;
      checkpointResolveRef.current = null;
      checkpointGatePromiseRef.current = null;
      r?.();
    };
  }, []);

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
    const idx = currentIndex;
    const items = flowItems;
    const item = items[idx] ?? null;
    const ok = await handleCompleteCurrent();
    if (!ok) {
      Alert.alert(
        t("courses.flow.saveProgressAlertTitle"),
        t("courses.flow.saveProgressFailed"),
      );
      return;
    }
    const cid = resolveCheckpointLessonId(items, idx, item);
    await waitLessonCheckpoint(cid);
    goNext();
  }, [
    currentIndex,
    flowItems,
    goNext,
    handleCompleteCurrent,
    resolveCheckpointLessonId,
    t,
    waitLessonCheckpoint,
  ]);

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
    const idx = currentIndex;
    const items = flowItems;
    const item = items[idx] ?? null;

    if (isExerciseItem(currentItem)) {
      const sid = currentItem.section.id;
      const sidNum = typeof sid === "number" ? sid : Number(sid);
      const done =
        Number.isFinite(sidNum) &&
        (currentItem.isCompleted || completedIds.has(`s-${sid}`));
      if (!done) {
        goNext();
        return;
      }
      await waitLessonCheckpoint(resolveCheckpointLessonId(items, idx, item));
      goNext();
      return;
    }
    if (!currentItem.isCompleted) {
      const ok = await handleCompleteCurrent();
      if (!ok) {
        Alert.alert(
          t("courses.flow.saveProgressAlertTitle"),
          t("courses.flow.saveProgressFailed"),
        );
        return;
      }
    }
    await waitLessonCheckpoint(resolveCheckpointLessonId(items, idx, item));
    goNext();
  }, [
    completedIds,
    continueBusy,
    currentIndex,
    currentItem,
    flowItems,
    goNext,
    handleCompleteCurrent,
    resolveCheckpointLessonId,
    t,
    waitLessonCheckpoint,
  ]);

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
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
        >
          <ConfettiCannon
            ref={confettiRef}
            count={120}
            origin={{ x: width / 2, y: 0 }}
            fadeOut
            autoStart={false}
          />
        </View>
        <Text style={styles.completeEmoji}>🎉</Text>
        <Text style={styles.completeTitle}>
          {t("courses.flow.courseComplete")}
        </Text>
        <Text style={styles.completeSubtitle}>
          {typeof pts === "number"
            ? `You have ${pts} total XP.`
            : t("courses.flow.courseCompleteSubtitle")}
        </Text>
        <View style={styles.completeActions}>
          {(() => {
            const cta = COURSE_TO_TOOL_CTA[courseId];
            if (!cta) return null;
            return (
              <Button
                onPress={() =>
                  router.push(cta.toolUrl as Parameters<typeof router.push>[0])
                }
              >
                {cta.ctaText}
              </Button>
            );
          })()}
          <Button onPress={() => router.push(`/quiz/${courseId}`)}>
            {t("courses.flow.takeQuiz")}
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/(tabs)")}>
            {t("courses.flow.backToDashboard")}
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.replace("/(tabs)/learn")}
          >
            {t("courses.flow.backToCourses")}
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
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          opacity: immersive ? 0 : 1,
        }}
      >
        <HeaderChatButton />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
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
          disabled={
            continueBusy || !currentItem || checkpointVisible || checkpointBusy
          }
          style={[
            styles.continueBtn,
            (continueBusy ||
              !currentItem ||
              checkpointVisible ||
              checkpointBusy) &&
              styles.continueBtnDisabled,
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

      <LessonCheckpointModal
        visible={checkpointVisible}
        quizzes={checkpointRows}
        courseId={courseId}
        onDone={finishCheckpointModal}
      />
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
    const body = section.text_content?.trim();
    return (
      <View>
        <VideoSection url={section.video_url} title={section.title} />
        {body ? (
          <TextSection
            html={section.text_content}
            fallbackText={section.text_content}
            fontScale={fontScale}
            leadingVideoUrl={section.video_url}
          />
        ) : null}
      </View>
    );
  }

  if (section.content_type === "exercise" || section.exercise_type) {
    const catalogId = catalogExerciseIdFromData(section.exercise_data);
    const useCatalogSubmit = catalogId != null;
    return (
      <View>
        <ExerciseSection
          exerciseType={section.exercise_type}
          exerciseData={section.exercise_data}
          exerciseId={useCatalogSubmit ? catalogId : section.id}
          sectionId={useCatalogSubmit ? section.id : undefined}
          gradingMode={useCatalogSubmit ? "standalone" : "lesson"}
          isCompleted={item.isCompleted}
          onAttempt={onAttempt}
          onComplete={onExerciseComplete}
        />
      </View>
    );
  }

  const hasLeadingVideo = Boolean(section.video_url?.trim());
  return (
    <View>
      {hasLeadingVideo ? (
        <VideoSection url={section.video_url} title={section.title} />
      ) : null}
      <TextSection
        html={section.text_content}
        fallbackText={section.text_content}
        fontScale={fontScale}
        leadingVideoUrl={hasLeadingVideo ? section.video_url : undefined}
      />
    </View>
  );
}
