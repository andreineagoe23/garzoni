import { useCallback, useEffect, useState } from "react";
import {
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
  completeCourseQuiz,
  fetchQuizzesForCourse,
  fetchProfile,
  queryKeys,
  staleTimes,
  useHearts,
} from "@monevo/core";
import {
  Button,
  ErrorState,
  HeartBar,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import MascotImage from "../../src/components/common/MascotImage";
import { colors, spacing, typography, radius, shadows } from "../../src/theme/tokens";
import * as Haptics from "expo-haptics";

type QuizRow = {
  id: number;
  title?: string;
  question?: string;
  choices?: { text: string }[];
  correct_answer?: string;
};

export default function QuizScreen() {
  const { courseId: courseIdParam } = useLocalSearchParams<{ courseId: string }>();
  const courseId = Number(courseIdParam);
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null); // null = no feedback yet
  const [earned, setEarned] = useState(0);
  const [done, setDone] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [correctAnswerSnapshot, setCorrectAnswerSnapshot] = useState<string | null>(null);

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
      const list = Array.isArray(raw) ? raw : [];
      return (list[0] as QuizRow | undefined) ?? null;
    },
    staleTime: staleTimes.content,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    enabled: done,
    staleTime: staleTimes.profile,
  });

  const quiz = quizQuery.data;

  useEffect(() => {
    if (done) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progressSummary() });
    }
  }, [done, queryClient]);

  const submit = useCallback(async () => {
    if (!quiz || selected == null) {
      setFeedback("Select an answer first.");
      return;
    }
    try {
      const res = await completeCourseQuiz({
        quiz_id: quiz.id,
        selected_answer: selected,
      });
      const isOk = res.data.correct === true;
      setCorrect(isOk);
      setFeedback(res.data.message ?? "");
      if (isOk) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEarned(Number(res.data.earned_money ?? 0));
        setCorrectAnswerSnapshot(selected);
        setDone(true);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        decrementHeart();
        setSelected(null);
      }
    } catch {
      setFeedback("Something went wrong.");
      setCorrect(null);
    }
  }, [quiz, selected, decrementHeart]);

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
          <Skeleton width="100%" height={120} style={{ marginTop: spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  if (quizQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ErrorState
          message="Could not load quiz."
          onRetry={() => void quizQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!quiz) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.muted}>No quiz for this course yet.</Text>
        <Button variant="secondary" onPress={() => router.back()}>
          Go back
        </Button>
      </SafeAreaView>
    );
  }

  if (done) {
    const pts = profileQuery.data?.points;
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Stack.Screen options={{ title: "Quiz", headerShown: true }} />
        <MascotImage mascot="owl" size={88} />
        <Text style={styles.resultTitle}>Quiz complete!</Text>
        <Text style={styles.resultSub}>{feedback}</Text>
        {earned > 0 ? (
          <Text style={styles.earn}>+{earned.toFixed(2)} earned</Text>
        ) : null}
        {typeof pts === "number" ? (
          <Text style={styles.xp}>Total XP: {pts}</Text>
        ) : null}
        <View style={styles.actions}>
          <Button onPress={() => router.replace("/(tabs)")}>Dashboard</Button>
          <Button variant="secondary" onPress={() => setReviewOpen((v) => !v)}>
            {reviewOpen ? "Hide review" : "Review answer"}
          </Button>
          <Button variant="ghost" onPress={() => router.replace("/(tabs)/learn")}>
            Learn tab
          </Button>
        </View>
        {reviewOpen ? (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewQ}>{quiz.question}</Text>
            <Text style={styles.reviewA}>
              Your answer: {correctAnswerSnapshot ?? selected ?? "—"}
            </Text>
            <Text style={styles.reviewOk}>
              Correct: {quiz.correct_answer}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: quiz.title ?? "Quiz", headerShown: true }} />
      <View style={styles.header}>
        <View style={styles.headerMid}>
          <Text style={styles.headerHint}>Answer correctly to earn rewards</Text>
          <ProgressBar value={selected ? 0.5 : 0.15} height={4} />
        </View>
        <HeartBar hearts={hearts} maxHearts={maxHearts} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.question}>{quiz.question}</Text>
        {(quiz.choices ?? []).map((c, i) => {
          const active = selected === c.text;
          return (
            <Pressable
              key={`${i}-${c.text}`}
              style={[styles.choice, active && styles.choiceOn]}
              onPress={() => setSelected(c.text)}
            >
              <Text style={[styles.choiceText, active && styles.choiceTextOn]}>
                {c.text}
              </Text>
            </Pressable>
          );
        })}

        <Button style={{ marginTop: spacing.lg }} onPress={() => void submit()}>
          Submit answer
        </Button>

        {feedback ? (
          <View style={styles.feedbackRow}>
            <MascotImage
              mascot={correct === true ? "owl" : "bull"}
              size={56}
              style={{ marginRight: spacing.md }}
            />
            <Text
              style={[
                styles.feedbackText,
                correct !== true && styles.feedbackBad,
              ]}
            >
              {feedback}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  feedbackText: { flex: 1, fontSize: typography.sm, color: colors.text, lineHeight: 20 },
  feedbackBad: { color: colors.error },
  muted: { color: colors.textMuted, marginBottom: spacing.lg, textAlign: "center" },
  resultTitle: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
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
  xp: { fontSize: typography.sm, color: colors.textMuted, marginTop: spacing.xs },
  actions: { width: "100%", marginTop: spacing.xxl, gap: spacing.md },
  reviewCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    width: "100%",
  },
  reviewQ: { fontSize: typography.sm, fontWeight: "600", color: colors.text },
  reviewA: { fontSize: typography.sm, color: colors.textMuted, marginTop: spacing.sm },
  reviewOk: { fontSize: typography.sm, color: colors.success, marginTop: spacing.xs },
});
