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
  fetchPersonalizedPath,
  getNextPersonalizedPathCourse,
  completeCourse,
  buildSkillPracticeHref,
  COURSE_TO_TOOL_CTA,
  getToolPracticeCtaForSkill,
  type MascotSituation,
  type MascotType,
  localizeSectionTitle,
} from "@garzoni/core";
import ConfettiCannon from "react-native-confetti-cannon";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button, ErrorState, HeartBar, ProgressBar } from "../components/ui";
import { safeImpactAsync } from "../utils/safeHaptics";
import { HeaderChatButton } from "../components/navigation/HeaderChatButton";
import { href } from "../navigation/href";
import MascotWithMessage from "../components/common/MascotWithMessage";
import TextSection from "../components/lesson/TextSection";
import VideoSection from "../components/lesson/VideoSection";
import ExerciseSection from "../components/lesson/ExerciseSection";
import { useLessonFlow, type FlowItem } from "./useLessonFlow";
import RewardClaimModal from "../components/engagement/RewardClaimModal";
import LessonCheckpointModal, {
  type CheckpointQuizRow,
} from "./LessonCheckpointModal";
import LessonAIHelpSheet, {
  type LessonAIHelpContext,
} from "./LessonAIHelpSheet";
import {
  INITIAL_WRONG_STREAK_STATE,
  nextWrongStreakState,
  type WrongStreakState,
} from "./wrongStreakTracker";
import { heartsPracticeDisplayState } from "./heartsPracticeStatus";
import {
  fetchLessonCheckpointQuizzes,
  fetchQuizzesForCourse,
} from "@garzoni/core";
import { layout, radius, shadows, spacing, typography } from "../theme/tokens";
import { useScreenGutter } from "../utils/platform";
import { useShowHeartsMobile } from "../hooks/useShowHeartsMobile";
import { useThemeColors } from "../theme/ThemeContext";
import type { ThemeColors } from "../theme/palettes";
import { useTranslation } from "react-i18next";

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
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      backgroundColor: c.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    bottomBarBack: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 999,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomBarBackText: {
      fontSize: typography.base,
      fontWeight: "700",
      color: c.text,
    },
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
      flex: 1,
      paddingVertical: 16,
      borderRadius: 999,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    continueBtnText: {
      fontSize: typography.base,
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
    heartsCapText: {
      fontSize: typography.sm,
      color: c.error,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: spacing.md,
    },
    heartsPracticeText: {
      fontSize: typography.sm,
      color: c.textMuted,
      textAlign: "center",
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
    },
    heartsPracticeCapText: {
      fontSize: typography.sm,
      color: c.textFaint,
      fontWeight: "600",
      textAlign: "center",
      marginTop: -spacing.xs,
      marginBottom: spacing.sm,
    },
    heartsUpgradeCta: {
      width: "100%",
      marginTop: spacing.md,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.accentMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accent,
      alignItems: "center",
    },
    heartsUpgradeCtaEmphasized: {
      borderWidth: 2,
    },
    heartsUpgradeCtaText: {
      fontSize: typography.sm,
      fontWeight: "700",
      color: c.accent,
      textAlign: "center",
    },
  });
}

export type LessonFlowScreenProps = {
  courseId: number;
  headerTitle: string;
  rotationKey: number;
  initialLessonId?: number | null;
};

export default function LessonFlowScreen({
  courseId,
  headerTitle,
  rotationKey,
  initialLessonId = null,
}: LessonFlowScreenProps) {
  const { t, i18n } = useTranslation("common");
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
    completedIds,
    courseComplete,
    missionCompletedNow,
    firstLessonCelebration,
    setMissionCompletedNow,
    goNext,
    goPrev,
    handleCompleteCurrent,
    completeSectionMutation,
    completeLessonMutation,
  } = useLessonFlow(courseId, { initialLessonId });

  const {
    hearts,
    maxHearts,
    decrementHeart,
    outOfHeartsUntilTs,
    refillHeartsSafe,
    nextHeartInSecondsRaw,
    heartsPracticeQuery,
  } = useHearts({ enabled: true, refetchIntervalMs: 30_000 });
  const heartsPractice = heartsPracticeDisplayState(heartsPracticeQuery.data);
  const showHeartsUi = useShowHeartsMobile();

  const personalizedPathQuery = useQuery({
    queryKey: queryKeys.personalizedPath(),
    queryFn: () => fetchPersonalizedPath().then((r) => r.data),
    staleTime: 60_000,
  });

  const nextPathCourse = useMemo(
    () =>
      getNextPersonalizedPathCourse(
        personalizedPathQuery.data?.courses ?? [],
        courseId,
      ),
    [personalizedPathQuery.data?.courses, courseId],
  );

  // Fires once per mount. Finishing a course marks EVERY published section
  // complete server-side (closes the resume-gap), then refreshes the views that
  // drive the journey tile. MUST run before navigating to the next course —
  // otherwise advancing away skips it and the tile never flips to done.
  const courseCompleteFiredRef = useRef(false);
  const finishCourse = useCallback(async () => {
    if (!courseCompleteFiredRef.current && Number.isFinite(courseId)) {
      courseCompleteFiredRef.current = true;
      try {
        await completeCourse(courseId);
      } catch {
        // Non-fatal: per-section saves already happened; tile may lag a refresh.
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.personalizedPath() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.progressSummary() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity() }),
    ]);
  }, [courseId, queryClient]);

  const goToNextPathCourse = useCallback(async () => {
    const nextId = nextPathCourse?.id;
    if (!nextId) return false;
    router.replace(`/flow/${nextId}`);
    return true;
  }, [nextPathCourse?.id]);

  // Paywall placement experiment (3.5): the onboarding "post_first_lesson" arm
  // defers the paywall to here. When the flag is set and this is the learner's
  // first-ever lesson, the celebration's primary CTA routes to the paywall
  // instead of the normal destination. Default flow is untouched.
  const POST_LESSON_PAYWALL_KEY = "garzoni:pending_post_lesson_paywall";
  const [pendingPostLessonPaywall, setPendingPostLessonPaywall] =
    useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(POST_LESSON_PAYWALL_KEY).then((v) =>
      setPendingPostLessonPaywall(v === "1"),
    );
  }, []);
  const routeToPostLessonPaywall = useCallback(() => {
    void AsyncStorage.removeItem(POST_LESSON_PAYWALL_KEY);
    setPendingPostLessonPaywall(false);
    router.replace("/subscriptions?mode=paywall&from=post_first_lesson");
  }, []);
  const showPostLessonPaywallCta =
    Boolean(firstLessonCelebration) && pendingPostLessonPaywall;

  // Per-section saves only mark progress queries stale (no refetch) to avoid a
  // request burst on every Continue tap. Flush ONE active refresh when the user
  // leaves the flow mid-course, so dashboard/journey are fresh on return.
  // Skipped when finishCourse already ran — that flush covers completion.
  useEffect(() => {
    return () => {
      if (courseCompleteFiredRef.current) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.personalizedPath(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.progressSummary(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.learningPaths(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentActivity(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activityHeatmap(),
      });
      void queryClient.invalidateQueries({ queryKey: ["learningPathCourses"] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceAfterStep = useCallback(async () => {
    if (isLast) {
      // Complete the current course FIRST so the tile is done before we leave.
      await finishCourse();
      if (await goToNextPathCourse()) return;
      goNext();
      return;
    }
    goNext();
  }, [goNext, goToNextPathCourse, isLast, finishCourse]);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    enabled: courseComplete,
    staleTime: staleTimes.profile,
  });

  // Some courses only have section-checkpoint quizzes (source_lesson_section
  // set); /quizzes/?course= excludes those, so the quiz screen would show
  // "No quiz data available." Hide the CTA instead.
  const courseQuizQuery = useQuery({
    queryKey: queryKeys.courseQuiz(courseId),
    queryFn: () =>
      fetchQuizzesForCourse(courseId).then((r) =>
        Array.isArray(r.data) ? r.data : [],
      ),
    enabled: courseComplete && Number.isFinite(courseId),
    staleTime: staleTimes.content,
  });
  const hasCourseQuiz = (courseQuizQuery.data?.length ?? 0) > 0;

  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);
  // Set when the free daily refill cap (429/403 with upgrade_hint) is hit.
  const [refillCapReached, setRefillCapReached] = useState(false);
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

  // Real AI intervention on repeat wrong answers: tracks CONSECUTIVE wrong
  // attempts on the current exercise (resets on exercise change or a correct
  // answer). On the 2nd consecutive wrong attempt we show an in-context
  // "rescue" sheet instead of immediately spending a heart — the heart
  // decrement for that attempt is deferred until the sheet is dismissed, so
  // it reads as a rescue rather than a consolation prize.
  const wrongStreakRef = useRef<WrongStreakState>(INITIAL_WRONG_STREAK_STATE);
  const pendingHeartDecrementRef = useRef(false);
  const [aiHelpVisible, setAiHelpVisible] = useState(false);
  const [aiHelpContext, setAiHelpContext] =
    useState<LessonAIHelpContext | null>(null);

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

  const coursePracticeRoute = useMemo(() => {
    const skill = String(headerTitle || currentItem?.lessonTitle || "").trim();
    if (!skill) return null;
    return buildSkillPracticeHref(skill, "lesson_complete_practice").replace(
      /^\/exercises/,
      "/(tabs)/exercises",
    );
  }, [currentItem?.lessonTitle, headerTitle]);
  const courseToolPracticeCta = useMemo(
    () => getToolPracticeCtaForSkill(headerTitle || currentItem?.lessonTitle),
    [currentItem?.lessonTitle, headerTitle],
  );

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
    if (!courseComplete) return;
    // Completion + invalidation already ran in finishCourse (before any
    // navigation). The terminal "no next course" path lands here — also ensure
    // the course is marked done, then celebrate.
    void finishCourse();
    setTimeout(() => confettiRef.current?.start(), 400);
  }, [courseComplete, finishCourse]);

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

  // Reset the consecutive-wrong streak whenever the exercise changes.
  useEffect(() => {
    wrongStreakRef.current = { index: currentIndex, count: 0 };
  }, [currentIndex]);

  const handleAiHelpDismiss = useCallback(() => {
    setAiHelpVisible(false);
    setAiHelpContext(null);
    if (pendingHeartDecrementRef.current) {
      pendingHeartDecrementRef.current = false;
      decrementHeart();
    }
  }, [decrementHeart]);

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

      const { state, shouldTriggerAiHelp } = nextWrongStreakState(
        wrongStreakRef.current,
        currentIndex,
        correct,
      );
      wrongStreakRef.current = state;

      if (correct) {
        return;
      }

      if (shouldTriggerAiHelp && isExerciseItem(currentItem)) {
        const data = (currentItem.section.exercise_data ?? {}) as Record<
          string,
          unknown
        >;
        const question =
          typeof data.question === "string" ? data.question : null;
        if (question) {
          setAiHelpContext({
            question,
            exerciseType: currentItem.section.exercise_type,
            correctAnswer: data.correctAnswer,
            skill: typeof data.skill === "string" ? data.skill : null,
            exerciseId:
              catalogExerciseIdFromData(data) ?? currentItem.section.id,
          });
          setAiHelpVisible(true);
          // Defer this attempt's heart loss until the learner dismisses the
          // rescue sheet — see handleAiHelpDismiss.
          pendingHeartDecrementRef.current = true;
          return;
        }
      }

      decrementHeart();
    },
    [decrementHeart, currentIndex, currentItem],
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
    await advanceAfterStep();
  }, [
    advanceAfterStep,
    currentIndex,
    flowItems,
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
    const raw = (s.title || currentItem.lessonTitle || "").trim();
    return localizeSectionTitle(raw, t, i18n.language);
  }, [currentItem, i18n.language, t]);

  const continueBusy =
    completeSectionMutation.isPending || completeLessonMutation.isPending;

  const handleContinuePress = useCallback(async () => {
    if (!currentItem || continueBusy) return;
    void safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        // Continue past an unanswered exercise is a deliberate skip — still
        // mark the section complete so reaching the end means all sections
        // are done and the journey tile can reach 100%. (Previously only the
        // final step saved on skip, so mid-course skips left progress stuck
        // below 100% even at 45/45.)
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
      await advanceAfterStep();
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
    await advanceAfterStep();
  }, [
    advanceAfterStep,
    completedIds,
    continueBusy,
    currentIndex,
    currentItem,
    flowItems,
    handleCompleteCurrent,
    resolveCheckpointLessonId,
    t,
    waitLessonCheckpoint,
  ]);

  const themeColors = useThemeColors();
  const gutter = useScreenGutter();
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
            count={firstLessonCelebration ? 240 : 120}
            origin={{ x: width / 2, y: 0 }}
            fadeOut
            autoStart={false}
          />
        </View>
        <Text style={styles.completeEmoji}>
          {firstLessonCelebration ? "🔥" : "🎉"}
        </Text>
        <Text style={styles.completeTitle}>
          {firstLessonCelebration
            ? t("courses.flow.firstLessonTitle")
            : t("courses.flow.courseComplete")}
        </Text>
        {firstLessonCelebration ? (
          <Text style={styles.completeSubtitle}>
            {t("courses.flow.firstLessonSubtitle", {
              bonus: firstLessonCelebration.bonusXp,
            })}
          </Text>
        ) : (
          <Text style={styles.completeSubtitle}>
            {typeof pts === "number"
              ? `You have ${pts} total XP.`
              : t("courses.flow.courseCompleteSubtitle")}
          </Text>
        )}
        <View style={styles.completeActions}>
          {showPostLessonPaywallCta ? (
            <Button onPress={routeToPostLessonPaywall}>
              {t("courses.flow.firstLessonUnlockCta")}
            </Button>
          ) : nextPathCourse?.id ? (
            <Button onPress={() => void goToNextPathCourse()}>
              {t("courses.flow.nextCourse")}
            </Button>
          ) : (
            <Button
              onPress={() =>
                router.replace(href("/(tabs)/learn?view=personalized"))
              }
            >
              {t("courses.flow.continueJourney")}
            </Button>
          )}
          {(() => {
            const cta = COURSE_TO_TOOL_CTA[courseId];
            const toolUrl =
              cta?.toolUrl || courseToolPracticeCta?.mobileToolUrl;
            if (!toolUrl) return null;
            return (
              <Button onPress={() => router.push(href(toolUrl))}>
                {cta?.ctaText ||
                  courseToolPracticeCta?.ctaText ||
                  "Put it to practice"}
              </Button>
            );
          })()}
          {coursePracticeRoute ? (
            <Button
              variant="secondary"
              onPress={() => router.push(href(coursePracticeRoute))}
            >
              {t("courses.flow.testWhatYouLearned", {
                defaultValue: "Test what you learned",
              })}
            </Button>
          ) : null}
          {hasCourseQuiz ? (
            <Button onPress={() => router.push(`/quiz/${courseId}`)}>
              {t("courses.flow.takeQuiz")}
            </Button>
          ) : null}
          <Button variant="secondary" onPress={() => router.replace("/(tabs)")}>
            {t("courses.flow.backToDashboard")}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.replace("/(tabs)/learn")}
          >
            {t("courses.flow.backToCourses")}
          </Button>
        </View>
        <RewardClaimModal
          visible={missionCompletedNow != null}
          missionName={missionCompletedNow?.name ?? ""}
          xp={missionCompletedNow?.xp ?? 0}
          onDismiss={() => setMissionCompletedNow(null)}
        />
      </SafeAreaView>
    );
  }

  // Bar tracks position through the flow (matches the "x / y sections"
  // counter). Completion-based progress confused users: skipped exercises
  // pinned the bar below 100% even on the last step.
  const progress = totalSteps > 0 ? (currentIndex + 1) / totalSteps : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
          opacity: immersive ? 0 : 1,
        }}
      >
        {/* Left: exit lesson → back (preserves caller's view state) */}
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/learn");
            }
          }}
          hitSlop={8}
          style={{ width: 36, alignItems: "flex-start" }}
        >
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </Pressable>

        {/* Center: Aa | Focus */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pressable onPress={() => setReadingSettingsOpen(true)} hitSlop={8}>
            <Text
              style={{
                color: themeColors.accent,
                fontWeight: "800",
                fontSize: typography.base,
              }}
            >
              Aa
            </Text>
          </Pressable>
          <Text
            style={{
              color: themeColors.border,
              fontSize: typography.base,
              marginHorizontal: spacing.sm,
            }}
          >
            |
          </Text>
          <Pressable onPress={() => setImmersive((v) => !v)} hitSlop={8}>
            <Text
              style={{
                color: immersive ? themeColors.accent : themeColors.textMuted,
                fontWeight: "600",
                fontSize: typography.base,
              }}
            >
              Focus
            </Text>
          </Pressable>
        </View>

        {/* Right: AI tutor */}
        <View style={{ width: 36, alignItems: "flex-end" }}>
          <HeaderChatButton />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: spacing.xl + 56,
            paddingHorizontal: layout.screenPaddingX + gutter,
          },
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
          {/* Progress bar + percentage */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
            <ProgressBar value={progress} height={5} style={{ flex: 1 }} />
            <Text style={styles.stepFoot}>{Math.round(progress * 100)}%</Text>
          </View>

          {/* Hearts + section count */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: spacing.sm,
            }}
          >
            {showHeartsUi ? (
              <HeartBar
                hearts={hearts}
                maxHearts={maxHearts}
                countdownLabel={heartCountdown}
              />
            ) : (
              <View />
            )}
            <Text style={styles.stepFoot}>
              {t("courses.flow.stepSections", {
                current: Math.min(currentIndex + 1, Math.max(totalSteps, 1)),
                total: Math.max(totalSteps, 1),
              })}
            </Text>
          </View>
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
          <Text style={styles.bottomBarBackText} numberOfLines={1}>
            {isFirst ? t("courses.flow.backToDashboard") : t("shared.back")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void handleContinuePress()}
          disabled={
            continueBusy ||
            !currentItem ||
            checkpointVisible ||
            checkpointBusy ||
            aiHelpVisible
          }
          style={[
            styles.continueBtn,
            (continueBusy ||
              !currentItem ||
              checkpointVisible ||
              checkpointBusy ||
              aiHelpVisible) &&
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
        statusBarTranslucent
        navigationBarTranslucent
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
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          setRefillCapReached(false);
          setOutOfHeartsVisible(false);
        }}
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
            {refillCapReached ? (
              <Text style={styles.heartsCapText}>
                {t("courses.flow.refillCapReached")}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={() =>
                  void (async () => {
                    try {
                      // The daily cap comes back as 200 + `refill_capped` so
                      // pre-cap clients degrade gracefully; the 429/403 branch
                      // stays for servers not yet on that behaviour.
                      const result = await refillHeartsSafe();
                      if (
                        (result as { refill_capped?: boolean } | null)
                          ?.refill_capped
                      ) {
                        setRefillCapReached(true);
                        return;
                      }
                      setRefillCapReached(false);
                      setOutOfHeartsVisible(false);
                    } catch (e) {
                      const resp = (
                        e as {
                          response?: {
                            status?: number;
                            data?: { upgrade_hint?: boolean };
                          };
                        }
                      )?.response;
                      if (
                        resp &&
                        (resp.status === 429 || resp.status === 403) &&
                        resp.data?.upgrade_hint
                      ) {
                        setRefillCapReached(true);
                      }
                    }
                  })()
                }
              >
                {t("courses.flow.refillHearts")}
              </Button>
              <Button
                variant="secondary"
                disabled={heartsPractice.kind === "capReached"}
                onPress={() => {
                  setRefillCapReached(false);
                  setOutOfHeartsVisible(false);
                  // Server-verified: correct answers to review-queue
                  // exercises earn the heart back (see hearts_practice.py).
                  // The client only routes there and displays progress.
                  router.push("/(tabs)/exercises");
                }}
              >
                {t("courses.flow.practiseHeart")}
              </Button>
              <Text
                style={
                  heartsPractice.kind === "capReached"
                    ? styles.heartsPracticeCapText
                    : styles.heartsPracticeText
                }
              >
                {heartsPractice.kind === "capReached"
                  ? t("courses.flow.practiceHeartsCapReached")
                  : t("courses.flow.practiceHeartsProgress", {
                      correctSoFar: heartsPractice.correctSoFar,
                      correctNeeded: heartsPractice.correctNeeded,
                    })}
              </Text>
              <Button
                onPress={() => {
                  setRefillCapReached(false);
                  setOutOfHeartsVisible(false);
                }}
              >
                Wait
              </Button>
            </View>
            {/* Upgrade path — Plus refills hearts 2× faster (server-side truth). */}
            <Pressable
              onPress={() => {
                setRefillCapReached(false);
                setOutOfHeartsVisible(false);
                router.push("/subscriptions?reason=hearts");
              }}
              style={[
                styles.heartsUpgradeCta,
                refillCapReached && styles.heartsUpgradeCtaEmphasized,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.heartsUpgradeCtaText}>
                {t("courses.flow.upgradeHeartsCta")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <LessonCheckpointModal
        visible={checkpointVisible}
        quizzes={checkpointRows}
        courseId={courseId}
        onDone={finishCheckpointModal}
      />

      <LessonAIHelpSheet
        visible={aiHelpVisible}
        context={aiHelpContext}
        onDismiss={handleAiHelpDismiss}
      />

      <RewardClaimModal
        visible={missionCompletedNow != null}
        missionName={missionCompletedNow?.name ?? ""}
        xp={missionCompletedNow?.xp ?? 0}
        onDismiss={() => setMissionCompletedNow(null)}
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
  const { t, i18n } = useTranslation("common");

  if (item.kind === "lesson-text") {
    return (
      <View>
        <TextSection html={item.detailedContent} fontScale={fontScale} />
      </View>
    );
  }

  const section = item.section;
  const sectionTitle = localizeSectionTitle(section.title, t, i18n.language);

  if (section.content_type === "video" && section.video_url) {
    const body = section.text_content?.trim();
    return (
      <View>
        <VideoSection url={section.video_url} title={sectionTitle} />
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
        <VideoSection url={section.video_url} title={sectionTitle} />
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
