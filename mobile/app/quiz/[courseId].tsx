import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MascotSituation } from "@garzoni/core";
import {
  completeCourseQuiz,
  fetchQuizzesForCourse,
  fetchProfile,
  queryKeys,
  staleTimes,
  useHearts,
} from "@garzoni/core";
import { useTranslation } from "react-i18next";
import {
  Button,
  ErrorState,
  HeartBar,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import type { ThemeColors } from "../../src/theme/palettes";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../src/theme/tokens";
import { NotificationFeedbackType } from "expo-haptics";
import { safeNotificationAsync } from "../../src/utils/safeHaptics";

type QuizRow = {
  id: number;
  title?: string;
  question?: string;
  choices?: { text: string }[];
  correct_answer?: string;
  is_completed?: boolean;
};

type Phase = "intro" | "attempt" | "recap";

export default function QuizScreen() {
  const { t } = useTranslation("common");
  const { courseId: courseIdParam } = useLocalSearchParams<{
    courseId: string;
  }>();
  const courseId = Number(courseIdParam);
  const queryClient = useQueryClient();
  const confettiRef = useRef<ConfettiCannon>(null);

  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [lastEarnedMoney, setLastEarnedMoney] = useState(0);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [mascotRotationKey, setMascotRotationKey] = useState(0);

  const quizFeedbackSituation = useMemo((): MascotSituation | undefined => {
    if (correct === true) return "quiz_correct";
    if (correct === false) return "quiz_incorrect";
    return undefined;
  }, [correct]);

  const { hearts, maxHearts, decrementHeart } = useHearts({
    enabled: true,
    refetchIntervalMs: 30_000,
  });

  const quizQuery = useQuery({
    queryKey: queryKeys.courseQuiz(courseId),
    enabled: Number.isFinite(courseId),
    queryFn: async () => {
      const res = await fetchQuizzesForCourse(courseId);
      const raw = res.data;
      const list = (Array.isArray(raw) ? raw : []) as QuizRow[];
      list.sort((a, b) => a.id - b.id);
      return list;
    },
    staleTime: staleTimes.content,
  });

  useEffect(() => {
    if (quizQuery.data) {
      setQuizzes(quizQuery.data);
      if (quizQuery.data.length === 0) return;
      if (quizQuery.data.every((q) => q.is_completed)) {
        setPhase("recap");
      } else {
        setPhase("intro");
      }
    }
  }, [quizQuery.data]);

  const ordered = useMemo(
    () => [...quizzes].sort((a, b) => a.id - b.id),
    [quizzes],
  );
  const activeQuiz = useMemo(
    () => ordered.find((q) => !q.is_completed) ?? null,
    [ordered],
  );
  const total = ordered.length;
  const completedCount = useMemo(
    () => ordered.filter((q) => q.is_completed).length,
    [ordered],
  );

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    enabled: phase === "recap",
    staleTime: staleTimes.profile,
  });

  useEffect(() => {
    if (phase === "recap") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.progressSummary(),
      });
      setTimeout(() => confettiRef.current?.start(), 300);
    }
  }, [phase, queryClient]);

  useEffect(() => {
    setSelected(null);
    setLastEarnedMoney(0);
    setLastEarnedPoints(0);
  }, [activeQuiz?.id]);

  const resetAttempt = useCallback(() => {
    setSelected(null);
    setFeedback("");
    setCorrect(null);
    setMascotRotationKey(0);
  }, []);

  const submit = useCallback(async () => {
    if (!activeQuiz || selected == null) {
      setCorrect(null);
      setFeedback(t("shared.pleaseSelectAnswer"));
      return;
    }
    try {
      const res = await completeCourseQuiz({
        quiz_id: activeQuiz.id,
        selected_answer: selected,
      });
      const isOk = res.data.correct === true;
      setCorrect(isOk);
      setFeedback(res.data.message ?? "");
      setMascotRotationKey((n) => n + 1);
      if (isOk) {
        void safeNotificationAsync(NotificationFeedbackType.Success);
        const money = Number(res.data.earned_money ?? 0);
        const pts = Number(res.data.earned_points ?? 0);
        setLastEarnedMoney(money);
        setLastEarnedPoints(pts);
        if (!res.data.already_completed) {
          setSessionXp((x) => x + pts);
          setSessionCoins((c) => c + money);
        }
        setQuizzes((prev) =>
          prev.map((q) =>
            q.id === activeQuiz.id ? { ...q, is_completed: true } : q,
          ),
        );
        if (!res.data.already_completed) {
          setSelected(null);
        }
      } else {
        void safeNotificationAsync(NotificationFeedbackType.Error);
        decrementHeart();
      }
    } catch {
      setFeedback(t("shared.somethingWentWrong"));
      setCorrect(null);
      setMascotRotationKey((n) => n + 1);
    }
  }, [activeQuiz, selected, decrementHeart, t]);

  const themeColors = useThemeColors();
  const styles = useMemo(() => makeQuizStyles(themeColors), [themeColors]);

  if (!Number.isFinite(courseId)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState message="Invalid course." />
      </SafeAreaView>
    );
  }

  if (quizQuery.isPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pad}>
          <Skeleton width="70%" height={28} />
          <Skeleton
            width="100%"
            height={120}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (quizQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState
          message={t("courses.quiz.loadFailed")}
          onRetry={() => void quizQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (total === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.muted}>{t("courses.quiz.noQuizData")}</Text>
        <Button variant="secondary" onPress={() => router.back()}>
          {t("courses.quiz.backToCourses")}
        </Button>
      </SafeAreaView>
    );
  }

  if (phase === "intro") {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Stack.Screen
          options={{ title: t("courses.quiz.introTitle"), headerShown: true }}
        />
        <Text style={styles.resultTitle}>{t("courses.quiz.introTitle")}</Text>
        <Text style={styles.resultSub}>
          {t("courses.quiz.introSubtitle", { count: total })}
        </Text>
        <Text style={[styles.resultSub, { marginTop: spacing.sm }]}>
          {t("courses.quiz.answerToEarn")}
        </Text>
        <View style={styles.actions}>
          <Button onPress={() => setPhase("attempt")}>
            {t("courses.quiz.introStart")}
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            {t("courses.quiz.backToCourses")}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "recap" || !activeQuiz) {
    const pts = profileQuery.data?.points;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Stack.Screen
          options={{ title: t("courses.quiz.recapTitle"), headerShown: true }}
        />
        <ConfettiCannon
          ref={confettiRef}
          count={90}
          origin={{ x: -10, y: 0 }}
          fadeOut
          autoStart={false}
        />
        <Text style={styles.resultTitle}>{t("courses.quiz.recapTitle")}</Text>
        <Text style={styles.resultSub}>{t("courses.quiz.recapSubtitle")}</Text>
        <Text style={styles.earn}>
          {t("courses.quiz.recapXpLine", { points: sessionXp })}
        </Text>
        <Text style={styles.xp}>
          {t("courses.quiz.recapCoinsLine", {
            amount: sessionCoins.toFixed(2),
          })}
        </Text>
        {typeof pts === "number" ? (
          <Text style={[styles.xp, { marginTop: spacing.xs }]}>
            Total XP: {pts}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button onPress={() => router.replace("/(tabs)")}>Dashboard</Button>
          <Button
            variant="ghost"
            onPress={() => router.replace("/(tabs)/learn")}
          >
            {t("courses.quiz.backToCourses")}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const flowProgress =
    total > 0
      ? Math.min(1, (completedCount + (correct === true ? 0.15 : 0)) / total)
      : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          title: activeQuiz.title ?? "Quiz",
          headerShown: true,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("courses.quiz.exitQuizAria")}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "300",
                  color: themeColors.textMuted,
                  lineHeight: 30,
                }}
              >
                ×
              </Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.header}>
        <View style={styles.headerMid}>
          <Text style={styles.headerHint}>
            {t("courses.quiz.progress", {
              current: Math.min(completedCount + 1, total),
              total,
            })}
          </Text>
          <ProgressBar value={flowProgress} height={4} />
        </View>
        <HeartBar hearts={hearts} maxHearts={maxHearts} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeIn.duration(280)}>
          <Text style={styles.question}>{activeQuiz.question}</Text>
          {(activeQuiz.choices ?? []).map((c, i) => {
            const active = selected === c.text;
            return (
              <Pressable
                key={`${activeQuiz.id}-${i}-${c.text}`}
                style={[styles.choice, active && styles.choiceOn]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelected(c.text);
                }}
              >
                <Text
                  style={[styles.choiceText, active && styles.choiceTextOn]}
                >
                  {c.text}
                </Text>
              </Pressable>
            );
          })}

          <Button
            style={{ marginTop: spacing.lg }}
            onPress={() => void submit()}
          >
            {t("courses.quiz.submitAnswer")}
          </Button>

          {correct === true && ordered.some((q) => !q.is_completed) ? (
            <Button
              variant="secondary"
              style={{ marginTop: spacing.md }}
              onPress={() => {
                resetAttempt();
              }}
            >
              {t("courses.quiz.nextQuiz")}
            </Button>
          ) : null}

          {correct === true && !ordered.some((q) => !q.is_completed) ? (
            <Button
              style={{ marginTop: spacing.md }}
              onPress={() => setPhase("recap")}
            >
              {t("courses.quiz.reviewFinish")}
            </Button>
          ) : null}

          {correct === false && activeQuiz.correct_answer ? (
            <Text style={[styles.inlineCorrect, { marginTop: spacing.md }]}>
              Correct answer: {activeQuiz.correct_answer}
            </Text>
          ) : null}

          {correct === false ? (
            <Button
              variant="secondary"
              style={{ marginTop: spacing.md }}
              onPress={resetAttempt}
            >
              Try again
            </Button>
          ) : null}

          {feedback ? (
            <View
              style={[
                styles.feedbackRow,
                correct === false ? styles.feedbackRowWarn : null,
              ]}
            >
              <MascotWithMessage
                mood={
                  correct === true
                    ? "celebrate"
                    : correct === false
                      ? "encourage"
                      : "neutral"
                }
                situation={quizFeedbackSituation}
                customMessage={feedback}
                rotationKey={mascotRotationKey}
                embedded
                mascotSize={56}
              />
            </View>
          ) : null}

          {correct === true && lastEarnedMoney > 0 ? (
            <Text style={[styles.earn, { marginTop: spacing.md }]}>
              {t("courses.quiz.youEarned", {
                amount: lastEarnedMoney.toFixed(2),
              })}
            </Text>
          ) : null}
          {correct === true && lastEarnedPoints > 0 ? (
            <Text style={styles.xp}>
              {t("courses.quiz.youEarnedXp", { points: lastEarnedPoints })}
            </Text>
          ) : null}
          {correct === true && lastEarnedPoints === 0 ? (
            <Text style={[styles.xp, { marginTop: spacing.sm }]}>
              {t("courses.quiz.alreadyCompletedShort")}
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeQuizStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    pad: { padding: spacing.xl },
    centered: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxxl,
      gap: spacing.md,
    },
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
    headerMid: { flex: 1, marginRight: spacing.md },
    headerHint: { fontSize: typography.xs, color: colors.textMuted },
    content: { padding: spacing.xl, paddingBottom: 48 },
    question: {
      fontSize: typography.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.lg,
      lineHeight: 26,
    },
    choice: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
    },
    choiceOn: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
    },
    choiceText: { fontSize: typography.base, color: colors.text },
    choiceTextOn: { fontWeight: "600", color: colors.primaryDark },
    feedbackRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: spacing.xl,
      padding: spacing.lg,
      backgroundColor: colors.surfaceOffset,
      borderRadius: radius.lg,
    },
    feedbackRowWarn: {
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.errorBg,
    },
    muted: {
      color: colors.textMuted,
      marginBottom: spacing.lg,
      textAlign: "center",
    },
    resultTitle: {
      fontSize: typography.xxl,
      fontWeight: "700",
      color: colors.text,
      marginTop: spacing.lg,
      textAlign: "center",
    },
    resultSub: {
      fontSize: typography.base,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    earn: {
      fontSize: typography.md,
      fontWeight: "600",
      color: colors.accent,
      marginTop: spacing.sm,
    },
    xp: {
      fontSize: typography.sm,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    actions: { width: "100%", marginTop: spacing.xxl, gap: spacing.md },
    inlineCorrect: {
      fontSize: typography.sm,
      fontWeight: "700",
      color: colors.success,
    },
  });
}
