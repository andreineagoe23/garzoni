import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  fetchQuestionnaireProgress,
  fetchNextQuestion,
  saveQuestionnaireAnswer,
  completeQuestionnaire,
  abandonQuestionnaire,
  type QuestionnaireQuestion,
  type NextQuestionResponse,
} from "@monevo/core";
import { Button, ProgressBar } from "../src/components/ui";
import { colors, spacing, typography, radius, shadows } from "../src/theme/tokens";

// ─── helpers ────────────────────────────────────────────────────────────────

function useSlideAnim() {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useCallback(() => {
    anim.setValue(40);
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
  }, [anim]);
  return { translateY: anim, slide };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SingleChoice({
  question,
  selected,
  onChange,
}: {
  question: QuestionnaireQuestion;
  selected: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.optionList}>
      {(question.options ?? []).map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(opt.value)}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MultiChoice({
  question,
  selected,
  onChange,
}: {
  question: QuestionnaireQuestion;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]
    );
  };
  return (
    <View style={styles.optionList}>
      {(question.options ?? []).map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => toggle(opt.value)}
          >
            <View style={[styles.checkbox, active && styles.checkboxActive]}>
              {active && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TextAnswer({
  value,
  onChange,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMulti]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      placeholder="Type your answer…"
      placeholderTextColor={colors.textFaint}
      returnKeyType={multiline ? "default" : "done"}
    />
  );
}

function NumberAnswer({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      keyboardType="numeric"
      placeholder="Enter a number"
      placeholderTextColor={colors.textFaint}
      returnKeyType="done"
    />
  );
}

// ─── completion overlay ──────────────────────────────────────────────────────

function CompletionOverlay({
  xp,
  coins,
  onContinue,
}: {
  xp: number;
  coins: number;
  onContinue: () => void;
}) {
  return (
    <View style={styles.completionOverlay}>
      <Text style={styles.completionEmoji}>🎉</Text>
      <Text style={styles.completionTitle}>You're all set!</Text>
      <Text style={styles.completionSub}>
        We've personalised your learning path based on your goals.
      </Text>
      <View style={styles.rewardRow}>
        {xp > 0 ? (
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardValue}>+{xp}</Text>
            <Text style={styles.rewardLabel}>XP</Text>
          </View>
        ) : null}
        {coins > 0 ? (
          <View style={[styles.rewardBadge, styles.rewardBadgeGold]}>
            <Text style={styles.rewardValue}>+{coins}</Text>
            <Text style={styles.rewardLabel}>Coins</Text>
          </View>
        ) : null}
      </View>
      <Button onPress={onContinue} style={styles.completionBtn}>
        Start learning
      </Button>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

type AnswerValue = string | string[] | null;

export default function OnboardingScreen() {
  const [phase, setPhase] = useState<"checking" | "questionnaire" | "done" | "error">(
    "checking"
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionData, setQuestionData] = useState<NextQuestionResponse | null>(null);
  const [answer, setAnswer] = useState<AnswerValue>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [completionRewards, setCompletionRewards] = useState<{
    xp: number;
    coins: number;
  } | null>(null);
  const questionStartRef = useRef(Date.now());
  const { translateY, slide } = useSlideAnim();

  // ── bootstrap: check existing progress ────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const progress = await fetchQuestionnaireProgress();
        if (progress.status === "completed") {
          router.replace("/(tabs)");
          return;
        }
        // in_progress or abandoned — resume
        await loadNextQuestion();
        setPhase("questionnaire");
      } catch {
        // If the API returns 404 / no questionnaire, treat as fresh start
        try {
          await loadNextQuestion();
          setPhase("questionnaire");
        } catch {
          setErrorMsg("Could not load your personalisation questionnaire.");
          setPhase("error");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextQuestion = async () => {
    setLoading(true);
    try {
      const data = await fetchNextQuestion();
      setQuestionData(data);
      setAnswer(deriveDefaultAnswer(data.question));
      questionStartRef.current = Date.now();
      slide();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!questionData) return;
    const q = questionData.question;

    if (q.required && !hasAnswer(answer)) {
      setErrorMsg("Please provide an answer before continuing.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000);
      await saveQuestionnaireAnswer({
        question_id: q.id,
        answer: answer ?? "",
        section_index: questionData.section_index,
        question_index: questionData.question_index,
        time_spent_seconds: timeSpent,
      });

      if (questionData.is_last_question) {
        const result = await completeQuestionnaire();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCompletionRewards(result.rewards);
        setPhase("done");
      } else {
        await loadNextQuestion();
      }
    } catch {
      setErrorMsg("Could not save your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await abandonQuestionnaire();
    } catch {
      // ignore
    }
    router.replace("/(tabs)");
  };

  // ── answer type helpers ────────────────────────────────────────────────────

  const question = questionData?.question ?? null;
  const progress = questionData?.progress_percentage ?? 0;
  const isLast = questionData?.is_last_question ?? false;

  const updateAnswer = useCallback((v: AnswerValue) => {
    setAnswer(v);
    setErrorMsg("");
  }, []);

  // ── render ────────────────────────────────────────────────────────────────

  if (phase === "checking") {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Button variant="secondary" onPress={() => router.replace("/(tabs)")}>
          Skip to app
        </Button>
      </SafeAreaView>
    );
  }

  if (phase === "done" && completionRewards) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <CompletionOverlay
          xp={completionRewards.xp}
          coins={completionRewards.coins}
          onContinue={() => router.replace("/(tabs)")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Personalise your journey</Text>
        <Pressable onPress={() => void handleSkip()} hitSlop={12}>
          <Text style={styles.skipLink}>Skip</Text>
        </Pressable>
      </View>

      <ProgressBar value={progress / 100} height={4} style={styles.progressBar} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : question ? (
            <Animated.View style={{ transform: [{ translateY }] }}>
              <Text style={styles.questionText}>{question.text}</Text>
              {question.description ? (
                <Text style={styles.questionDesc}>{question.description}</Text>
              ) : null}

              {question.type === "single_choice" && (
                <SingleChoice
                  question={question}
                  selected={typeof answer === "string" ? answer : null}
                  onChange={(v) => updateAnswer(v)}
                />
              )}

              {question.type === "multiple_choice" && (
                <MultiChoice
                  question={question}
                  selected={Array.isArray(answer) ? answer : []}
                  onChange={(v) => updateAnswer(v)}
                />
              )}

              {(question.type === "text" || question.type === "long_text") && (
                <TextAnswer
                  value={typeof answer === "string" ? answer : ""}
                  onChange={(v) => updateAnswer(v)}
                  multiline={question.type === "long_text"}
                />
              )}

              {(question.type === "number" || question.type === "integer") && (
                <NumberAnswer
                  value={typeof answer === "string" ? answer : ""}
                  onChange={(v) => updateAnswer(v)}
                />
              )}

              {errorMsg ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}

              <View style={styles.actions}>
                <Button
                  loading={submitting}
                  onPress={() => void handleSubmit()}
                >
                  {isLast ? "Finish" : "Continue"}
                </Button>
                {!question.required ? (
                  <Button
                    variant="ghost"
                    onPress={() => {
                      setAnswer(deriveDefaultAnswer(question));
                      void handleSubmit();
                    }}
                  >
                    Skip this question
                  </Button>
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {questionData ? (
        <Text style={styles.stepCounter}>
          Question {questionData.current_question_number ?? "—"} of{" "}
          {questionData.total_questions ?? "—"}
        </Text>
      ) : null}
    </SafeAreaView>
  );
}

// ─── utils ────────────────────────────────────────────────────────────────────

function deriveDefaultAnswer(q: QuestionnaireQuestion): AnswerValue {
  if (q.type === "multiple_choice") return [];
  return null;
}

function hasAnswer(v: AnswerValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center", padding: spacing.xxxl },
  centeredLoader: { paddingVertical: spacing.xxxxl, alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    color: colors.text,
  },
  skipLink: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: "600",
  },
  progressBar: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.full,
    overflow: "hidden",
  },

  content: {
    padding: spacing.xl,
    paddingBottom: 80,
  },
  questionText: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 30,
  },
  questionDesc: {
    fontSize: typography.base,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },

  // options
  optionList: { gap: spacing.sm, marginTop: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0d`,
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    marginLeft: spacing.md,
  },
  optionLabelActive: { fontWeight: "600", color: colors.primaryDark },

  // radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: "700" },

  // text / number inputs
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  textInputMulti: {
    height: 110,
    textAlignVertical: "top",
  },

  errorText: {
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.md,
  },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },

  stepCounter: {
    textAlign: "center",
    fontSize: typography.xs,
    color: colors.textMuted,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },

  // completion
  completionOverlay: { alignItems: "center", width: "100%", paddingHorizontal: spacing.lg },
  completionEmoji: { fontSize: 72 },
  completionTitle: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  completionSub: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  rewardRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  rewardBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  rewardBadgeGold: { borderColor: colors.accent },
  rewardValue: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  rewardLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  completionBtn: { width: "100%" },
});
