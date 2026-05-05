import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import Svg, {
  Circle,
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
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
  queryKeys,
  type QuestionnaireQuestion,
  type NextQuestionResponse,
} from "@garzoni/core";
import OnboardingIntroPager from "../src/components/onboarding/steps/OnboardingIntroPager";
import OnboardingCompletionOverlay from "../src/components/onboarding/steps/OnboardingCompletionOverlay";
import QuestionnaireSingleChoice from "../src/components/onboarding/steps/QuestionnaireSingleChoice";
import QuestionnaireMultiChoice from "../src/components/onboarding/steps/QuestionnaireMultiChoice";
import QuestionnaireTextAnswer from "../src/components/onboarding/steps/QuestionnaireTextAnswer";
import QuestionnaireNumberAnswer from "../src/components/onboarding/steps/QuestionnaireNumberAnswer";
import { href } from "../src/navigation/href";
import { registerForPushAndSubmitToken } from "../src/bootstrap/pushNotificationsMobile";
import { brand } from "../src/theme/brand";
import LoadingSpinner from "../src/components/ui/LoadingSpinner";

const INTRO_STORAGE_KEY = "garzoni:onboarding_intro_v1";

const DARK = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  primary: brand.green,
  primaryBright: "#2a7347",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
  error: "#ef4444",
};

type GlowProps = {
  width: number;
  height: number;
  color: string;
  opacity?: number;
  stopFar?: number;
  shape?: "circle" | "ellipse";
};
function Glow({
  width,
  height,
  color,
  opacity = 1,
  stopFar = 0.6,
  shape = "ellipse",
}: GlowProps) {
  const id = `obg-${Math.round(width)}-${Math.round(height)}-${color.length}`;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop
            offset={`${stopFar * 100}%`}
            stopColor={color}
            stopOpacity={0}
          />
        </RadialGradient>
      </Defs>
      {shape === "circle" ? (
        <Circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2}
          fill={`url(#${id})`}
        />
      ) : (
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#${id})`}
        />
      )}
    </Svg>
  );
}

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
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ reason?: string | string[] }>();
  const reasonParam = Array.isArray(params.reason)
    ? params.reason[0]
    : params.reason;
  const personalizedPathReason =
    String(reasonParam ?? "").toLowerCase() === "personalized_path";
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
      setErrorMsg(t("onboarding.errorLoad"));
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    void (async () => {
      try {
        const progress = await fetchQuestionnaireProgress();
        if (progress.status === "completed") {
          router.replace("/(tabs)");
          return;
        }
        if (
          progress.status === "in_progress" ||
          progress.status === "abandoned"
        ) {
          await AsyncStorage.setItem(INTRO_STORAGE_KEY, "1");
          await loadNextQuestion();
          setPhase("questionnaire");
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
          setErrorMsg(t("onboarding.errorLoad"));
          setPhase("error");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleSubmit = async () => {
    if (!questionData) return;
    const q = questionData.question;

    if (q.required && !hasAnswer(answer)) {
      setErrorMsg(t("onboarding.selectAnswer"));
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
        await AsyncStorage.setItem(INTRO_STORAGE_KEY, "1");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.questionnaireProgress(),
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.personalizedPath(),
        });
        void safeNotificationAsync(NotificationFeedbackType.Success);
        setCompletionRewards(result.rewards);
        setPhase("done");
      } else {
        await loadNextQuestion();
      }
    } catch {
      setErrorMsg(t("onboarding.failedToSave"));
    } finally {
      setSubmitting(false);
    }
  };

  const question = questionData?.question ?? null;
  const progress = questionData?.progress_percentage ?? 0;
  const isLast = questionData?.is_last_question ?? false;
  const currentNum = questionData?.current_question_number ?? 1;
  const totalNum = questionData?.total_questions ?? 1;

  const updateAnswer = useCallback((v: AnswerValue) => {
    setAnswer(v);
    setErrorMsg("");
  }, []);

  const goToPaywall = useCallback(() => {
    router.replace("/subscriptions?mode=paywall");
  }, []);

  const handleCompletionContinue = useCallback(() => {
    Alert.alert(
      t("onboarding.pushPrompt.title"),
      t("onboarding.pushPrompt.body"),
      [
        {
          text: t("onboarding.pushPrompt.notNow"),
          style: "cancel",
          onPress: goToPaywall,
        },
        {
          text: t("onboarding.pushPrompt.enable"),
          onPress: () => {
            void (async () => {
              await registerForPushAndSubmitToken();
              goToPaywall();
            })();
          },
        },
      ],
    );
  }, [goToPaywall, t]);

  if (phase === "checking") {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingSpinner size="lg" color={DARK.primary} />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Pressable
          style={styles.cta}
          onPress={() =>
            router.replace(
              href(
                personalizedPathReason
                  ? "/onboarding?reason=personalized_path"
                  : "/onboarding",
              ),
            )
          }
        >
          <View style={styles.ctaHighlight} pointerEvents="none" />
          <Text style={styles.ctaLabel}>{t("onboarding.tryAgain")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === "intro") {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.ambientTop} pointerEvents="none">
          <Glow
            width={460}
            height={320}
            color={DARK.primary}
            opacity={0.18}
            stopFar={0.55}
          />
        </View>
        <View style={styles.introHeader}>
          <Text style={styles.eyebrow}>
            {(personalizedPathReason
              ? t("onboarding.questionnaireHeaderPersonalized")
              : t("onboarding.welcomeTitle")
            ).toUpperCase()}
          </Text>
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
          onContinue={handleCompletionContinue}
        />
      </SafeAreaView>
    );
  }

  const progressPct = Math.max(0, Math.min(100, progress));
  const submitDisabled =
    submitting || (question?.required && !hasAnswer(answer));

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.ambientTop} pointerEvents="none">
        <Glow
          width={460}
          height={320}
          color={DARK.primary}
          opacity={0.18}
          stopFar={0.55}
        />
      </View>
      <View style={styles.ambientBottom} pointerEvents="none">
        <Glow
          width={360}
          height={260}
          color={DARK.goldWarm}
          opacity={0.05}
          stopFar={0.5}
        />
      </View>

      <View style={styles.header}>
        <View style={styles.progressCol}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
        <Text style={styles.frac}>
          <Text style={styles.fracNum}>{currentNum}</Text>
          <Text style={styles.fracSlash}>/{totalNum}</Text>
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centeredLoader}>
              <LoadingSpinner size="sm" color={DARK.primary} />
            </View>
          ) : question ? (
            <Animated.View style={{ transform: [{ translateY }] }}>
              <Text style={styles.screenEyebrow}>
                {t("onboarding.questionnaireHeaderDefault").toUpperCase()}
              </Text>
              <Text style={styles.headline}>{question.text}</Text>
              {question.description ? (
                <Text style={styles.subhead}>{question.description}</Text>
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
                <Pressable
                  onPress={() => void handleSubmit()}
                  disabled={submitDisabled}
                  style={[styles.cta, submitDisabled && styles.ctaDisabled]}
                  accessibilityRole="button"
                >
                  <View style={styles.ctaHighlight} pointerEvents="none" />
                  {submitting ? (
                    <LoadingSpinner size="sm" color="#fff" />
                  ) : (
                    <Text style={styles.ctaLabel}>
                      {isLast
                        ? t("onboarding.finish")
                        : t("onboarding.continue")}
                    </Text>
                  )}
                </Pressable>
                {!question.required ? (
                  <Pressable
                    onPress={() => {
                      setAnswer(deriveDefaultAnswer(question));
                      void handleSubmit();
                    }}
                    style={styles.skipBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.skipLabel}>
                      {t("onboarding.skipQuestion")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.footnote}>
                {t("onboarding.changeLaterHint", {
                  defaultValue: "You can change this anytime in Settings",
                })}
              </Text>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  safe: { flex: 1, backgroundColor: DARK.bg },
  centered: { alignItems: "center", justifyContent: "center", padding: 24 },
  centeredLoader: { paddingVertical: 64, alignItems: "center" },

  ambientTop: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  ambientBottom: { position: "absolute", bottom: -40, right: -60 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  progressCol: { flex: 1 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DARK.ghost,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DARK.primaryBright,
  },
  frac: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  fracNum: {
    color: DARK.gold,
    fontStyle: "italic",
  },
  fracSlash: { color: DARK.faint },

  introHeader: { paddingHorizontal: 24, paddingTop: 24 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: DARK.faint,
    fontWeight: "500",
  },

  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 80 },

  screenEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: DARK.faint,
    fontWeight: "500",
    marginBottom: 12,
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: DARK.text,
  },
  subhead: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: DARK.muted,
    maxWidth: 360,
  },

  errorText: { fontSize: 13, color: DARK.error, marginTop: 14 },

  actions: { marginTop: 22, gap: 10 },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: DARK.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  skipBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    color: DARK.muted,
    fontSize: 14,
    fontWeight: "500",
  },

  footnote: {
    textAlign: "center",
    marginTop: 18,
    fontSize: 12,
    color: DARK.faint,
    letterSpacing: 0.2,
  },
});
