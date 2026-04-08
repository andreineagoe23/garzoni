import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "expo-haptics";
import {
  safeImpactAsync,
  safeNotificationAsync,
} from "../src/utils/safeHaptics";
import {
  fetchQuestionnaireProgress,
  fetchNextQuestion,
  saveQuestionnaireAnswer,
  completeQuestionnaire,
  abandonQuestionnaire,
  type QuestionnaireQuestion,
  type NextQuestionResponse,
} from "@garzoni/core";
import { Button, ProgressBar } from "../src/components/ui";
import OnboardingIntroPager from "../src/components/onboarding/steps/OnboardingIntroPager";
import OnboardingCompletionOverlay from "../src/components/onboarding/steps/OnboardingCompletionOverlay";
import QuestionnaireSingleChoice from "../src/components/onboarding/steps/QuestionnaireSingleChoice";
import QuestionnaireMultiChoice from "../src/components/onboarding/steps/QuestionnaireMultiChoice";
import QuestionnaireTextAnswer from "../src/components/onboarding/steps/QuestionnaireTextAnswer";
import QuestionnaireNumberAnswer from "../src/components/onboarding/steps/QuestionnaireNumberAnswer";
import {
  colors,
  spacing,
  typography,
  radius,
  shadows,
} from "../src/theme/tokens";

const INTRO_STORAGE_KEY = "garzoni:onboarding_intro_v1";

function useSlideAnim() {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useCallback(() => {
    anim.setValue(40);
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
    }).start();
  }, [anim]);
  return { translateY: anim, slide };
}

type AnswerValue = string | string[] | null;

export default function OnboardingScreen() {
  const [phase, setPhase] = useState<
    "checking" | "intro" | "questionnaire" | "done" | "error"
  >("checking");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionData, setQuestionData] = useState<NextQuestionResponse | null>(
    null,
  );
  const [answer, setAnswer] = useState<AnswerValue>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [completionRewards, setCompletionRewards] = useState<{
    xp: number;
    coins: number;
  } | null>(null);
  const questionStartRef = useRef(Date.now());
  const { translateY, slide } = useSlideAnim();

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

  const beginQuestionnaireAfterIntro = useCallback(async () => {
    await AsyncStorage.setItem(INTRO_STORAGE_KEY, "1");
    try {
      await loadNextQuestion();
      setPhase("questionnaire");
    } catch {
      setErrorMsg("Could not load your personalisation questionnaire.");
      setPhase("error");
    }
  }, [slide]);

  useEffect(() => {
    void (async () => {
      try {
        const progress = await fetchQuestionnaireProgress();
        if (progress.status === "completed") {
          router.replace("/(tabs)");
          return;
        }
        const introSeen = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
        if (introSeen !== "1") {
          setPhase("intro");
          return;
        }
        await loadNextQuestion();
        setPhase("questionnaire");
      } catch {
        try {
          const introSeen = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
          if (introSeen !== "1") {
            setPhase("intro");
            return;
          }
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

  const confirmSkipPersonalisation = useCallback(() => {
    Alert.alert(
      "Skip personalisation?",
      "You can still use the app, but we won't tailor your path until you complete this questionnaire.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => {
            void (async () => {
              void safeImpactAsync(ImpactFeedbackStyle.Light);
              try {
                await abandonQuestionnaire();
              } catch {
                // ignore
              }
              router.replace("/(tabs)");
            })();
          },
        },
      ],
    );
  }, []);

  const handleSubmit = async () => {
    if (!questionData) return;
    const q = questionData.question;

    if (q.required && !hasAnswer(answer)) {
      setErrorMsg("Please provide an answer before continuing.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);
    void safeImpactAsync(ImpactFeedbackStyle.Light);

    try {
      const timeSpent = Math.round(
        (Date.now() - questionStartRef.current) / 1000,
      );
      await saveQuestionnaireAnswer({
        question_id: q.id,
        answer: answer ?? "",
        section_index: questionData.section_index,
        question_index: questionData.question_index,
        time_spent_seconds: timeSpent,
      });

      if (questionData.is_last_question) {
        const result = await completeQuestionnaire();
        void safeNotificationAsync(NotificationFeedbackType.Success);
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

  const question = questionData?.question ?? null;
  const progress = questionData?.progress_percentage ?? 0;
  const isLast = questionData?.is_last_question ?? false;

  const updateAnswer = useCallback((v: AnswerValue) => {
    setAnswer(v);
    setErrorMsg("");
  }, []);

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

  if (phase === "intro") {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome</Text>
          <Pressable onPress={confirmSkipPersonalisation} hitSlop={12}>
            <Text style={styles.skipLink}>Skip</Text>
          </Pressable>
        </View>
        <OnboardingIntroPager
          onDone={() => void beginQuestionnaireAfterIntro()}
        />
      </SafeAreaView>
    );
  }

  if (phase === "done" && completionRewards) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <OnboardingCompletionOverlay
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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Personalise your journey</Text>
        <Pressable onPress={confirmSkipPersonalisation} hitSlop={12}>
          <Text style={styles.skipLink}>Skip</Text>
        </Pressable>
      </View>

      <ProgressBar
        value={progress / 100}
        height={4}
        style={styles.progressBar}
      />

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
                <QuestionnaireSingleChoice
                  question={question}
                  selected={typeof answer === "string" ? answer : null}
                  onChange={(v) => updateAnswer(v)}
                />
              )}

              {question.type === "multiple_choice" && (
                <QuestionnaireMultiChoice
                  question={question}
                  selected={Array.isArray(answer) ? answer : []}
                  onChange={(v) => updateAnswer(v)}
                />
              )}

              {(question.type === "text" || question.type === "long_text") && (
                <QuestionnaireTextAnswer
                  value={typeof answer === "string" ? answer : ""}
                  onChange={(v) => updateAnswer(v)}
                  multiline={question.type === "long_text"}
                />
              )}

              {(question.type === "number" || question.type === "integer") && (
                <QuestionnaireNumberAnswer
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxxl,
  },
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
});
