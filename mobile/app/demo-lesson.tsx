import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { brand } from "../src/theme/brand";
import { setWelcomeSeen } from "../src/auth/firstRunFlags";
import { trackEvent } from "../src/lib/analytics";

const C = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
  correct: "#2a7347",
  wrong: "#ef4444",
};

const XP_PER_CORRECT = 10;

type Step =
  | { kind: "info"; title: string; body: string }
  | {
      kind: "question";
      prompt: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }
  | { kind: "done" };

export default function DemoLessonScreen() {
  const { t } = useTranslation("common");

  // Fully local content — no network, no guest account (3.1 mobile).
  const steps: Step[] = [
    {
      kind: "info",
      title: t("demoLesson.info1.title"),
      body: t("demoLesson.info1.body"),
    },
    {
      kind: "question",
      prompt: t("demoLesson.q1.prompt"),
      options: t("demoLesson.q1.options", {
        returnObjects: true,
      }) as unknown as string[],
      correctIndex: 0,
      explanation: t("demoLesson.q1.explanation"),
    },
    {
      kind: "info",
      title: t("demoLesson.info2.title"),
      body: t("demoLesson.info2.body"),
    },
    {
      kind: "question",
      prompt: t("demoLesson.q2.prompt"),
      options: t("demoLesson.q2.options", {
        returnObjects: true,
      }) as unknown as string[],
      correctIndex: 1,
      explanation: t("demoLesson.q2.explanation"),
    },
    { kind: "done" },
  ];
  const total = steps.length;

  const [stepIndex, setStepIndex] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const completedRef = useRef(false);
  useEffect(() => {
    trackEvent("demo_lesson_started", { topic: "50_30_20" });
  }, []);

  const step = steps[stepIndex];

  // Animated XP tick.
  const xpScale = useRef(new Animated.Value(1)).current;
  const bumpXp = () => {
    Animated.sequence([
      Animated.timing(xpScale, {
        toValue: 1.25,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(xpScale, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const progressPct = Math.round((stepIndex / (total - 1)) * 100);

  const goNext = () => {
    setSelected(null);
    setAnswered(false);
    setStepIndex((i) => Math.min(total - 1, i + 1));
  };

  const checkAnswer = () => {
    if (step.kind !== "question" || selected == null) return;
    setAnswered(true);
    if (selected === step.correctIndex) {
      setXp((v) => v + XP_PER_CORRECT);
      setCorrectCount((v) => v + 1);
      bumpXp();
    }
  };

  // Fire completion once the done step renders.
  useEffect(() => {
    if (step.kind === "done" && !completedRef.current) {
      completedRef.current = true;
      trackEvent("demo_lesson_completed", {
        topic: "50_30_20",
        correct_count: correctCount,
      });
    }
  }, [step.kind, correctCount]);

  const leave = async (dest: "/register" | "/login") => {
    await setWelcomeSeen();
    router.replace(dest);
  };

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header: progress + close + XP */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          style={s.closeBtn}
        >
          <Text style={s.closeLabel}>✕</Text>
        </Pressable>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Animated.View style={[s.xpPill, { transform: [{ scale: xpScale }] }]}>
          <Text style={s.xpPillText}>{t("demoLesson.xpBadge", { xp })}</Text>
        </Animated.View>
      </View>

      {step.kind === "done" ? (
        <View style={s.doneWrap}>
          <Text style={s.doneEmoji}>🎉</Text>
          <Text style={s.doneTitle}>{t("demoLesson.done.title", { xp })}</Text>
          <Text style={s.doneSubtitle}>{t("demoLesson.done.subtitle")}</Text>
          <View style={s.doneActions}>
            <Pressable
              onPress={() => void leave("/register")}
              style={({ pressed }) => [s.cta, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
            >
              <View style={s.ctaHighlight} pointerEvents="none" />
              <Text style={s.ctaLabel}>
                {t("demoLesson.done.createAccount")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void leave("/login")}
              style={s.secondaryBtn}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={s.secondaryLabel}>{t("demoLesson.done.login")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.eyebrow}>
            {t("demoLesson.eyebrow").toUpperCase()} ·{" "}
            {t("demoLesson.stepLabel", {
              current: stepIndex + 1,
              total: total - 1,
            })}
          </Text>

          {step.kind === "info" ? (
            <>
              <Text style={s.headline}>{step.title}</Text>
              <Text style={s.infoBody}>{step.body}</Text>
            </>
          ) : (
            <>
              <Text style={s.headline}>{step.prompt}</Text>
              <View style={s.options}>
                {step.options.map((opt, i) => {
                  const isSel = selected === i;
                  const isCorrect = i === step.correctIndex;
                  let borderColor: string = C.border;
                  let bg: string = C.surfaceRaised;
                  if (answered) {
                    if (isCorrect) {
                      borderColor = C.correct;
                      bg = "rgba(42,115,71,0.16)";
                    } else if (isSel) {
                      borderColor = C.wrong;
                      bg = "rgba(239,68,68,0.12)";
                    }
                  } else if (isSel) {
                    borderColor = C.primaryBright;
                  }
                  return (
                    <Pressable
                      key={i}
                      onPress={() => !answered && setSelected(i)}
                      disabled={answered}
                      accessibilityRole="button"
                      style={[s.option, { borderColor, backgroundColor: bg }]}
                    >
                      <Text style={s.optionText}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {answered ? (
                <View
                  style={[
                    s.feedback,
                    {
                      borderColor:
                        selected === step.correctIndex ? C.correct : C.wrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.feedbackTitle,
                      {
                        color:
                          selected === step.correctIndex ? C.goldWarm : C.wrong,
                      },
                    ]}
                  >
                    {selected === step.correctIndex
                      ? t("demoLesson.correct")
                      : t("demoLesson.incorrect")}
                  </Text>
                  <Text style={s.feedbackBody}>{step.explanation}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {/* Footer CTA for info + question steps */}
      {step.kind !== "done" ? (
        <View style={s.footer}>
          {step.kind === "question" && !answered ? (
            <Pressable
              onPress={checkAnswer}
              disabled={selected == null}
              style={[s.cta, selected == null && s.ctaDisabled]}
              accessibilityRole="button"
            >
              <View style={s.ctaHighlight} pointerEvents="none" />
              <Text style={s.ctaLabel}>{t("demoLesson.checkAnswer")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={goNext}
              style={s.cta}
              accessibilityRole="button"
            >
              <View style={s.ctaHighlight} pointerEvents="none" />
              <Text style={s.ctaLabel}>
                {stepIndex >= total - 2
                  ? t("demoLesson.finish")
                  : t("demoLesson.continue")}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  closeLabel: { color: C.faint, fontSize: 18, fontWeight: "600" },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.ghost,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primaryBright,
  },
  xpPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(230,200,122,0.14)",
    borderWidth: 1,
    borderColor: "rgba(230,200,122,0.4)",
  },
  xpPillText: {
    color: C.goldWarm,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: C.faint,
    fontWeight: "600",
    marginBottom: 14,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "500",
    letterSpacing: -0.6,
    color: C.text,
  },

  infoBody: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 24,
    color: C.text,
  },

  options: { marginTop: 22, gap: 12 },
  option: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
  },

  feedback: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  feedbackBody: {
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  ctaDisabled: { opacity: 0.5 },
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

  doneWrap: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  doneEmoji: { fontSize: 56, marginBottom: 12 },
  doneTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.5,
    color: C.text,
    textAlign: "center",
  },
  doneSubtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
    color: C.muted,
    textAlign: "center",
    maxWidth: 320,
  },
  doneActions: {
    marginTop: 32,
    width: "100%",
    gap: 8,
  },
  secondaryBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
