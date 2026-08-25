import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
// react-native's SafeAreaView is a no-op on Android; with edgeToEdgeEnabled the
// header would sit under the status bar. Commit e591d3ca made this swap for the
// other full-screen routes and missed this one.
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { setWelcomeSeen } from "../src/auth/firstRunFlags";
import { trackEvent } from "../src/lib/analytics";
import {
  useLessonColors,
  useLessonStyles,
  type LessonColors,
} from "../src/lesson/lessonTheme";
import { layout, radius, spacing, typography } from "../src/theme/tokens";

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
  // Shared lesson look — see src/lesson/lessonTheme.ts. The demo used to carry
  // a private palette of raw hex, which is how it drifted away from the flow it
  // is meant to advertise.
  const { styles: ls } = useLessonStyles();
  const lc = useLessonColors();
  const s = useDemoStyles(lc);

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
    // Only "seen" once the user is heading to sign in — someone who taps
    // "Create free account" and backs out would otherwise be routed past the
    // welcome screen to /login forever, having never actually seen it.
    if (dest === "/login") {
      await setWelcomeSeen();
    }
    router.replace(dest);
  };

  return (
    <SafeAreaView style={ls.screen}>
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
        <View style={[ls.progressTrack, s.progressGrow]}>
          <View style={[ls.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Animated.View
          style={[ls.rewardPill, { transform: [{ scale: xpScale }] }]}
        >
          <Text style={ls.rewardPillText}>
            {t("demoLesson.xpBadge", { xp })}
          </Text>
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
              style={({ pressed }) => [ls.cta, pressed && s.ctaPressed]}
              accessibilityRole="button"
            >
              <View style={ls.ctaHighlight} pointerEvents="none" />
              <Text style={ls.ctaLabel}>
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
                  return (
                    <Pressable
                      key={i}
                      onPress={() => !answered && setSelected(i)}
                      disabled={answered}
                      accessibilityRole="button"
                      style={[
                        ls.optionBase,
                        answered && isCorrect && ls.optionCorrect,
                        answered && !isCorrect && isSel && ls.optionWrong,
                        !answered && isSel && { borderColor: lc.action },
                      ]}
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
                        selected === step.correctIndex
                          ? lc.positive
                          : lc.negative,
                    },
                  ]}
                >
                  <Text
                    style={[
                      selected === step.correctIndex
                        ? ls.feedbackCorrect
                        : ls.feedbackWrong,
                      s.feedbackTitleGap,
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
              style={[ls.cta, selected == null && ls.ctaDisabled]}
              accessibilityRole="button"
            >
              <View style={ls.ctaHighlight} pointerEvents="none" />
              <Text style={ls.ctaLabel}>{t("demoLesson.checkAnswer")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={goNext}
              style={ls.cta}
              accessibilityRole="button"
            >
              <View style={ls.ctaHighlight} pointerEvents="none" />
              <Text style={ls.ctaLabel}>
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

/**
 * Demo-only chrome. Anything a real lesson also renders — CTA, options,
 * progress, feedback, reward pill — comes from `useLessonStyles()`; only the
 * welcome-flow furniture belongs here, and all of it on the token scales.
 */
function useDemoStyles(lc: LessonColors) {
  return useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: layout.screenPaddingX,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
        },
        progressGrow: { flex: 1 },
        closeBtn: {
          width: spacing.xxxl,
          height: spacing.xxxl,
          alignItems: "center",
          justifyContent: "center",
        },
        closeLabel: {
          color: lc.textFaint,
          fontSize: typography.lg,
          fontWeight: "600",
        },

        content: {
          flexGrow: 1,
          paddingHorizontal: layout.screenPaddingX,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
        },
        eyebrow: {
          fontSize: typography.xs,
          letterSpacing: 1.6,
          color: lc.textFaint,
          fontWeight: "600",
          marginBottom: spacing.lg,
        },
        headline: {
          fontSize: typography.xxl,
          lineHeight: typography.hero,
          fontWeight: "500",
          letterSpacing: -0.6,
          color: lc.text,
        },

        infoBody: {
          marginTop: spacing.xl,
          fontSize: typography.md,
          lineHeight: typography.md * 1.5,
          color: lc.text,
        },

        options: { marginTop: spacing.xl, gap: spacing.md },
        optionText: {
          fontSize: typography.base,
          fontWeight: "600",
          color: lc.text,
        },

        feedback: {
          marginTop: spacing.xl,
          borderRadius: radius.lg,
          borderWidth: 1,
          backgroundColor: lc.surface,
          padding: spacing.lg,
        },
        feedbackTitleGap: { marginBottom: spacing.xs },
        feedbackBody: {
          fontSize: typography.sm,
          lineHeight: typography.sm * 1.6,
          color: lc.textMuted,
        },

        footer: {
          paddingHorizontal: layout.screenPaddingX,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxl,
        },
        ctaPressed: { opacity: 0.88 },

        doneWrap: {
          flex: 1,
          paddingHorizontal: layout.screenPaddingX,
          alignItems: "center",
          justifyContent: "center",
        },
        /** Decorative glyph — sized like LessonFlowScreen's modalEmoji. */
        doneEmoji: { fontSize: 56, marginBottom: spacing.md },
        doneTitle: {
          fontSize: typography.xxl,
          lineHeight: typography.xxl * 1.15,
          fontWeight: "600",
          letterSpacing: -0.5,
          color: lc.text,
          textAlign: "center",
        },
        doneSubtitle: {
          marginTop: spacing.md,
          fontSize: typography.md,
          lineHeight: typography.md * 1.45,
          color: lc.textMuted,
          textAlign: "center",
          /** Measure cap, not a spacing step: keeps the line length readable. */
          maxWidth: 320,
        },
        doneActions: {
          marginTop: spacing.xxxl,
          width: "100%",
          gap: spacing.sm,
        },
        secondaryBtn: {
          height: spacing.xxxxl,
          alignItems: "center",
          justifyContent: "center",
        },
        secondaryLabel: {
          color: lc.textMuted,
          fontSize: typography.sm,
          fontWeight: "600",
        },
      }),
    [lc],
  );
}
