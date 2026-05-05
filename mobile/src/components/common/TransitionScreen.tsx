import { useEffect, useRef, useState } from "react";
import { Animated, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../theme/tokens";
import { Button } from "../ui";
import AuthLogoMark from "../auth/AuthLogoMark";

export type TransitionVariant = "onboarding" | "payment" | "path-refresh" | "upgrade";

interface Props {
  variant: TransitionVariant;
  /** XP earned — shown for onboarding variant only */
  xp?: number;
  /** Coins earned — shown for onboarding variant only */
  coins?: number;
  /** Optional real-time step statuses — advances steps as work completes. Falls back to timer if absent. */
  stepStatuses?: ("pending" | "done")[];
  onComplete: () => void;
}

// ─── Step timing ──────────────────────────────────────────────
const T = {
  step1Appear: 300,
  step1Done: 1050,
  step2Appear: 1200,
  step2Done: 1950,
  step3Appear: 2100,
  step3Done: 2850,
  reveal: 3200,
};

// ─── Per-variant copy ──────────────────────────────────────────
const COPY: Record<
  TransitionVariant,
  { steps: [string, string, string]; headline: string; sub: string; cta: string }
> = {
  onboarding: {
    steps: [
      "Reading your answers",
      "Mapping your weak spots",
      "Curating your first lessons",
    ],
    headline: "Your path is ready",
    sub: "We built it around what you actually want to learn.",
    cta: "Start learning",
  },
  payment: {
    steps: [
      "Confirming your plan",
      "Unlocking premium content",
      "Setting up your experience",
    ],
    headline: "You're all set",
    sub: "Full access is now active. Let's get to work.",
    cta: "Explore your path",
  },
  "path-refresh": {
    steps: [
      "Analyzing your progress",
      "Recalibrating your path",
      "Updating your lessons",
    ],
    headline: "Your path is updated",
    sub: "We refreshed it based on how far you've come.",
    cta: "See what's new",
  },
  upgrade: {
    steps: [
      "Confirming your upgrade",
      "Unlocking new features",
      "Setting up your account",
    ],
    headline: "Upgrade complete",
    sub: "Your new plan is active and ready.",
    cta: "Get started",
  },
};

// ─── Single animated step row ──────────────────────────────────
function StepRow({
  label,
  visible,
  done,
}: {
  label: string;
  visible: boolean;
  done: boolean;
}) {
  const c = useThemeColors();

  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowSlide = useRef(new Animated.Value(6)).current;
  const checkScale = useRef(new Animated.Value(0.4)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  // Row enter
  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(rowOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(rowSlide, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkmark pop
  useEffect(() => {
    if (!done) return;
    Animated.parallel([
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(checkScale, {
        toValue: 1,
        speed: 28,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.stepRow,
        { opacity: rowOpacity, transform: [{ translateY: rowSlide }] },
      ]}
    >
      {/* Circle / checkmark */}
      <Animated.View
        style={[
          styles.stepCircle,
          {
            borderColor: done ? c.primaryBright : c.border,
            backgroundColor: done ? c.primaryBright : "transparent",
            opacity: done ? checkOpacity : 1,
            transform: [{ scale: done ? checkScale : 1 }],
          },
        ]}
      >
        {done && <Text style={styles.checkmark}>✓</Text>}
        {!done && (
          <View style={[styles.stepDot, { backgroundColor: c.border }]} />
        )}
      </Animated.View>

      <Text
        style={[
          styles.stepLabel,
          {
            color: done ? c.text : c.textMuted,
            fontWeight: done ? "500" : "400",
          },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── Reward badge (onboarding) ─────────────────────────────────
function RewardBadge({
  value,
  label,
  color,
  delay,
}: {
  value: string;
  label: string;
  color: string;
  delay: number;
}) {
  const c = useThemeColors();
  const anim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 12,
        bounciness: 10,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          borderColor: color,
          backgroundColor: c.surface,
          opacity: anim,
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={[styles.badgeValue, { color }]}>{value}</Text>
      <Text style={[styles.badgeLabel, { color: c.textMuted }]}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main component ────────────────────────────────────────────
export default function TransitionScreen({
  variant,
  xp,
  coins,
  stepStatuses,
  onComplete,
}: Props) {
  const c = useThemeColors();
  const copy = COPY[variant];

  const [step1Visible, setStep1Visible] = useState(false);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Visible, setStep2Visible] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Visible, setStep3Visible] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);

  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealSlide = useRef(new Animated.Value(16)).current;
  const minCtaGuard = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerReveal = () => {
    setRevealed(true);
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(revealSlide, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
    // Wait for reveal fade animation before showing CTA
    minCtaGuard.current = setTimeout(() => setCtaReady(true), 420);
  };

  // Timer-based flow (default, or when stepStatuses absent)
  useEffect(() => {
    if (stepStatuses) return;
    const ids = [
      setTimeout(() => setStep1Visible(true), T.step1Appear),
      setTimeout(() => setStep1Done(true), T.step1Done),
      setTimeout(() => setStep2Visible(true), T.step2Appear),
      setTimeout(() => setStep2Done(true), T.step2Done),
      setTimeout(() => setStep3Visible(true), T.step3Appear),
      setTimeout(() => setStep3Done(true), T.step3Done),
      setTimeout(triggerReveal, T.reveal),
    ];
    return () => {
      ids.forEach(clearTimeout);
      if (minCtaGuard.current) clearTimeout(minCtaGuard.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Status-driven flow: advance steps as real async work completes
  useEffect(() => {
    if (!stepStatuses) return;
    const [s1, s2, s3] = stepStatuses;
    setStep1Visible(true);
    if (s1 === "done") {
      setStep1Done(true);
      setStep2Visible(true);
    }
    if (s2 === "done") {
      setStep2Done(true);
      setStep3Visible(true);
    }
    if (s3 === "done") {
      setStep3Done(true);
      if (!revealed) triggerReveal();
    }
  }, [stepStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <AuthLogoMark />
        </View>

        {/* Steps */}
        <View style={styles.stepsBlock}>
          <StepRow
            label={copy.steps[0]}
            visible={step1Visible}
            done={step1Done}
          />
          <StepRow
            label={copy.steps[1]}
            visible={step2Visible}
            done={step2Done}
          />
          <StepRow
            label={copy.steps[2]}
            visible={step3Visible}
            done={step3Done}
          />
        </View>

        {/* Reveal section */}
        {revealed && (
          <Animated.View
            style={[
              styles.revealBlock,
              {
                opacity: revealOpacity,
                transform: [{ translateY: revealSlide }],
              },
            ]}
          >
            {/* Headline */}
            <Text style={[styles.headline, { color: c.text }]}>
              {copy.headline}
            </Text>
            <Text style={[styles.sub, { color: c.text }]}>{copy.sub}</Text>

            {/* Rewards row — onboarding only */}
            {variant === "onboarding" &&
              ((xp ?? 0) > 0 || (coins ?? 0) > 0) && (
                <View style={styles.badgeRow}>
                  {(xp ?? 0) > 0 && (
                    <RewardBadge
                      value={`+${xp}`}
                      label="XP"
                      color={c.primaryBright}
                      delay={80}
                    />
                  )}
                  {(coins ?? 0) > 0 && (
                    <RewardBadge
                      value={`+${coins}`}
                      label="Coins"
                      color={c.accent}
                      delay={200}
                    />
                  )}
                </View>
              )}

            {/* CTA — unlocks once all steps done + min 1200ms */}
            {ctaReady && (
              <Button onPress={onComplete} style={styles.cta}>
                {copy.cta}
              </Button>
            )}
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  logoWrap: {
    marginBottom: spacing.xxxl,
    alignItems: "center",
  },
  stepsBlock: {
    width: "100%",
    maxWidth: 320,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepLabel: {
    fontSize: typography.base,
    flex: 1,
    lineHeight: 22,
  },
  revealBlock: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  headline: {
    fontSize: typography.hero,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  sub: {
    fontSize: typography.base,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
    maxWidth: 300,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  badge: {
    alignItems: "center",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    minWidth: 96,
    ...shadows.sm,
  },
  badgeValue: {
    fontSize: typography.hero,
    fontWeight: "800",
  },
  badgeLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cta: {
    width: "100%",
  },
});
