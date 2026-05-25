import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { authLogoWhiteRectangularUrl } from "@garzoni/core";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { brand } from "../../../theme/brand";
import { darkPalette } from "../../../theme/palettes";
import { spacing, typography, radius } from "../../../theme/tokens";

const C = {
  bg: brand.bgDark,
  surface: brand.bgCard,
  surfaceRaised: darkPalette.surfaceElevated,
  primary: brand.green,
  primaryBright: brand.greenBright,
  primarySoft: brand.greenSoft,
  goldWarm: brand.goldWarm,
  gold: brand.gold,
  border: brand.borderGlass,
  borderSoft: darkPalette.borderSoft,
  text: brand.text,
  muted: brand.textMuted,
  faint: darkPalette.textFaint,
  ghost: "rgba(229,231,235,0.08)",
};

type LoadingStep = { label: string; detail: string };

function useLoadingSteps(): LoadingStep[] {
  const { t } = useTranslation("common");
  return useMemo(
    () => [
      {
        label: t("onboarding.loadingSteps.step1.label"),
        detail: t("onboarding.loadingSteps.step1.detail"),
      },
      {
        label: t("onboarding.loadingSteps.step2.label"),
        detail: t("onboarding.loadingSteps.step2.detail"),
      },
      {
        label: t("onboarding.loadingSteps.step3.label"),
        detail: t("onboarding.loadingSteps.step3.detail"),
      },
    ],
    [t],
  );
}

const STEP_DURATION = 1600;
const STEP_DELAY = 300;

// ── Ambient glow ─────────────────────────────────────────────────────────────
function Glow({
  width,
  height,
  color,
  opacity = 1,
}: {
  width: number;
  height: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="g" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="65%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height / 2}
        rx={width / 2}
        ry={height / 2}
        fill="url(#g)"
      />
    </Svg>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 22 }: { size?: number }) {
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rot]);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle
          cx="10"
          cy="10"
          r="8"
          stroke={C.primaryBright}
          strokeOpacity={0.2}
          strokeWidth="2.5"
        />
        <Path
          d="M10 2 A8 8 0 0 1 18 10"
          stroke={C.primaryBright}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

// ── Checkmark ─────────────────────────────────────────────────────────────────
function Check({ size = 22 }: { size?: number }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  }, [scale]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.primaryBright,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale }],
      }}
    >
      <Svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 12 12"
        fill="none"
      >
        <Path
          d="M2 6l3 3 5-5.5"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

// ── Step row ───────────────────────────────────────────────────────────────────
function StepRow({
  step,
  state,
  isLast,
}: {
  step: LoadingStep;
  state: 0 | 1 | 2;
  isLast: boolean;
}) {
  const detailHeight = useRef(new Animated.Value(0)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = state === 1 || state === 2;
    Animated.parallel([
      Animated.timing(detailHeight, {
        toValue: show ? 1 : 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(detailOpacity, {
        toValue: show ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [state, detailHeight, detailOpacity]);

  const rowOpacity = state === 0 ? 0.35 : 1;

  return (
    <View
      style={[
        s.stepRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: C.borderSoft,
        },
      ]}
    >
      <View style={s.stepTop}>
        <View style={s.iconWrap}>
          {state === 2 && <Check size={22} />}
          {state === 1 && <Spinner size={22} />}
          {state === 0 && (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: C.ghost,
              }}
            />
          )}
        </View>
        <Text
          style={[
            s.stepLabel,
            { opacity: rowOpacity, color: state === 0 ? C.faint : C.text },
          ]}
        >
          {step.label}
        </Text>
      </View>

      <Animated.View
        style={{
          marginLeft: 36,
          maxHeight: detailHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 36],
          }),
          opacity: detailOpacity,
          overflow: "hidden",
        }}
      >
        <Text style={s.stepDetail}>{step.detail}</Text>
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════════════════
// LOADING SCREEN
// ══════════════════════════════════════════════
function LoadingScreen({ onDone }: { onDone: () => void }) {
  const steps = useLoadingSteps();
  const [states, setStates] = useState<(0 | 1 | 2)[]>([0, 0, 0]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [displayPct, setDisplayPct] = useState(0);

  const fadeUp = useRef(new Animated.Value(0)).current;
  const fadeUpY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    // Fade in
    Animated.parallel([
      Animated.timing(fadeUp, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeUpY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeUp, fadeUpY]);

  const animateTo = (target: number) => {
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setDisplayPct(Math.round(value));
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    setStates([1, 0, 0]);
    animateTo(15);

    timers.push(
      setTimeout(() => {
        setStates([2, 1, 0]);
        animateTo(50);
      }, STEP_DURATION),
    );

    timers.push(
      setTimeout(
        () => {
          setStates([2, 2, 1]);
          animateTo(80);
        },
        STEP_DURATION * 2 + STEP_DELAY,
      ),
    );

    timers.push(
      setTimeout(
        () => {
          setStates([2, 2, 2]);
          animateTo(100);
        },
        STEP_DURATION * 3 + STEP_DELAY * 2,
      ),
    );

    timers.push(
      setTimeout(
        () => {
          onDone();
        },
        STEP_DURATION * 3 + STEP_DELAY * 2 + 900,
      ),
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={s.screen}>
      {/* Ambient glow */}
      <View style={s.ambientTop} pointerEvents="none">
        <Glow width={340} height={280} color={C.primary} opacity={0.22} />
      </View>

      <Animated.View
        style={{
          opacity: fadeUp,
          transform: [{ translateY: fadeUpY }],
          width: "100%",
          alignItems: "center",
          paddingTop: spacing.xxxxl + spacing.xl,
        }}
      >
        {/* Logo */}
        <Image
          source={{ uri: authLogoWhiteRectangularUrl({ width: 560 }) }}
          style={s.logo}
          resizeMode="contain"
          accessibilityLabel="Garzoni"
        />

        {/* Steps */}
        <View style={[s.stepsContainer, { marginTop: spacing.xxxl }]}>
          {steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              state={states[i]}
              isLast={i === steps.length - 1}
            />
          ))}
        </View>

        {/* Progress bar */}
        <View style={s.progressSection}>
          <View style={s.progressMeta}>
            <Text style={s.progressLabel}>Building your path</Text>
            <Text
              style={[
                s.progressPct,
                displayPct === 100 && { color: C.primaryBright },
              ]}
            >
              {displayPct}%
            </Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: barWidth }]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════════════════
// READY SCREEN
// ══════════════════════════════════════════════
function ReadyScreen({
  xp,
  coins,
  onStart,
}: {
  xp: number;
  coins: number;
  onStart: () => void;
}) {
  const steps = useLoadingSteps();
  const fadeVals = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const yVals = [
    useRef(new Animated.Value(12)).current,
    useRef(new Animated.Value(12)).current,
    useRef(new Animated.Value(12)).current,
    useRef(new Animated.Value(12)).current,
  ];

  useEffect(() => {
    const delays = [0, 80, 160, 240];
    fadeVals.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          delay: delays[i],
          useNativeDriver: true,
        }),
        Animated.timing(yVals[i], {
          toValue: 0,
          duration: 500,
          delay: delays[i],
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const makeAnim = (i: number) => ({
    opacity: fadeVals[i],
    transform: [{ translateY: yVals[i] }],
  });

  return (
    <View style={s.screen}>
      <View style={s.ambientMid} pointerEvents="none">
        <Glow width={380} height={320} color={C.primary} opacity={0.16} />
      </View>

      {/* Centre content */}
      <View style={s.readyCenter}>
        {/* Steps summary */}
        <Animated.View style={[s.stepsSummary, makeAnim(0)]}>
          {steps.map((step, i) => (
            <View key={i} style={s.summaryRow}>
              <Check size={20} />
              <Text style={s.summaryLabel}>{step.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Headline */}
        <Animated.View style={[s.headlineWrap, makeAnim(1)]}>
          <Text style={s.headline}>
            Your path is <Text style={s.headlineEm}>ready</Text>
          </Text>
          <Text style={s.headlineSub}>
            We built it around what you actually want to learn.
          </Text>
        </Animated.View>

        {/* Reward cards */}
        <Animated.View style={[s.cardsRow, makeAnim(2)]}>
          <View style={s.rewardCard}>
            <Text style={[s.rewardValue, { color: C.primaryBright }]}>
              +{xp}
            </Text>
            <Text style={s.rewardLabel}>XP</Text>
          </View>
          <View style={[s.rewardCard, s.rewardCardGold]}>
            <Text style={[s.rewardValue, { color: C.goldWarm }]}>+{coins}</Text>
            <Text style={[s.rewardLabel, { color: "rgba(230,200,122,0.5)" }]}>
              Coins
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* CTA pinned to bottom */}
      <Animated.View style={[s.ctaWrap, makeAnim(3)]}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.88 }]}
        >
          <View style={s.ctaHighlight} pointerEvents="none" />
          <Text style={s.ctaLabel}>Start learning</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════
type Props = {
  xp: number;
  coins: number;
  onContinue: () => void;
};

export default function OnboardingLoadingScreen({
  xp,
  coins,
  onContinue,
}: Props) {
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  return (
    <View style={{ flex: 1 }}>
      {phase === "loading" && (
        <LoadingScreen onDone={() => setPhase("ready")} />
      )}
      {phase === "ready" && (
        <ReadyScreen xp={xp} coins={coins} onStart={onContinue} />
      )}
    </View>
  );
}

// ══════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    position: "relative",
    overflow: "hidden",
  },

  ambientTop: {
    position: "absolute",
    top: -80,
    alignSelf: "center",
  },
  ambientMid: {
    position: "absolute",
    top: "20%",
    alignSelf: "center",
  },

  // Logo
  logo: {
    width: 160,
    height: 44,
  },

  // Steps — fixed width centered block, content left-aligned
  stepsContainer: {
    width: 320,
    alignSelf: "center",
  },
  stepRow: {
    paddingVertical: spacing.lg,
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  stepDetail: {
    fontSize: 12,
    color: C.faint,
    lineHeight: 18,
    marginTop: 5,
  },

  // Progress — same fixed width as steps
  progressSection: {
    width: 320,
    alignSelf: "center",
    marginTop: spacing.xl + spacing.sm,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: C.faint,
  },
  progressPct: {
    fontFamily: brand.fontMono,
    fontSize: 11,
    color: C.faint,
  },
  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: C.ghost,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: C.primaryBright,
    shadowColor: C.primaryBright,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  // Ready screen
  readyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl + spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  stepsSummary: {
    width: "100%",
    gap: spacing.md - 2,
    marginBottom: spacing.xxxl + spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md - 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: C.muted,
  },

  headlineWrap: {
    alignItems: "center",
    marginBottom: spacing.xxxl + spacing.sm,
  },
  headline: {
    fontFamily: brand.fontDisplay,
    fontWeight: "400",
    fontSize: 38,
    letterSpacing: -0.8,
    lineHeight: 42,
    color: C.text,
    textAlign: "center",
    marginBottom: spacing.sm + 2,
  },
  headlineEm: {
    fontFamily: brand.fontDisplayItalic,
    fontStyle: "italic",
    color: C.goldWarm,
  },
  headlineSub: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 22,
    textAlign: "center",
  },

  cardsRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  rewardCard: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: C.surfaceRaised,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: spacing.xl + spacing.sm,
    paddingHorizontal: spacing.lg + spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  rewardCardGold: {
    borderColor: "rgba(230,200,122,0.3)",
  },
  rewardValue: {
    fontFamily: brand.fontDisplay,
    fontSize: 36,
    fontWeight: "400",
    letterSpacing: -1,
  },
  rewardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.faint,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl + spacing.sm,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: C.primaryBright,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
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
});
