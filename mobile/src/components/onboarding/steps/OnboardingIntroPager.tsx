import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ImpactFeedbackStyle } from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { safeImpactAsync } from "../../../utils/safeHaptics";
import LottieHero from "../../motion/LottieHero";
import { Button } from "../../ui";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, spacing, typography } from "../../../theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");

export type IntroSlide = {
  key: string;
  title: string;
  body: string;
  emoji: string;
  lottieSource?: ComponentProps<typeof LottieHero>["source"];
};

type Props = {
  onDone: () => void;
  slides?: IntroSlide[];
};

function buildDefaultSlides(t: (k: string) => string): IntroSlide[] {
  return [
    {
      key: "welcome",
      title: t("onboarding.introSlides.welcome.title"),
      body: t("onboarding.introSlides.welcome.body"),
      emoji: "👋",
    },
    {
      key: "personalize",
      title: t("onboarding.introSlides.personalize.title"),
      body: t("onboarding.introSlides.personalize.body"),
      emoji: "🎯",
    },
    {
      key: "earn",
      title: t("onboarding.introSlides.earn.title"),
      body: t("onboarding.introSlides.earn.body"),
      emoji: "⭐",
    },
    {
      key: "plans",
      title: t("onboarding.introSlides.plans.title"),
      body: t("onboarding.introSlides.plans.body"),
      emoji: "💳",
    },
  ];
}

export default function OnboardingIntroPager({ onDone, slides }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const resolvedSlides = useMemo(
    () => slides ?? buildDefaultSlides(t),
    [slides, t],
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Hero spring animation on slide change
  const heroScale = useRef(new Animated.Value(1)).current;
  const heroOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    heroScale.setValue(0.85);
    heroOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(heroScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 10,
      }),
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [page, reduceMotion, heroScale, heroOpacity]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / SCREEN_W);
      if (next !== page && next >= 0 && next < resolvedSlides.length) {
        void safeImpactAsync(ImpactFeedbackStyle.Light);
        setPage(next);
      }
    },
    [page, resolvedSlides.length],
  );

  const goNext = useCallback(() => {
    if (page < resolvedSlides.length - 1) {
      scrollRef.current?.scrollTo({
        x: SCREEN_W * (page + 1),
        animated: true,
      });
      setPage((p) => p + 1);
      void safeImpactAsync(ImpactFeedbackStyle.Light);
    } else {
      onDone();
    }
  }, [page, resolvedSlides.length, onDone]);

  const goBack = useCallback(() => {
    if (page === 0) return;
    scrollRef.current?.scrollTo({ x: SCREEN_W * (page - 1), animated: true });
    setPage((p) => p - 1);
    void safeImpactAsync(ImpactFeedbackStyle.Light);
  }, [page]);

  const isLast = page === resolvedSlides.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.topBar}>
        {!isLast ? (
          <Pressable
            onPress={() => {
              void safeImpactAsync(ImpactFeedbackStyle.Light);
              onDone();
            }}
            hitSlop={12}
            style={styles.skipBtn}
          >
            <Text style={[styles.skipText, { color: c.textMuted }]}>
              {t("onboarding.introSkip")}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {resolvedSlides.map((s, i) => {
          const isActive = i === page;
          return (
            <View key={s.key} style={[styles.page, { width: SCREEN_W }]}>
              <Animated.View
                style={[
                  styles.heroWrap,
                  isActive && {
                    transform: [{ scale: heroScale }],
                    opacity: heroOpacity,
                  },
                ]}
              >
                <View
                  style={[
                    styles.haloOuter,
                    { backgroundColor: `${c.primary}14` },
                  ]}
                />
                <View
                  style={[
                    styles.haloInner,
                    { backgroundColor: `${c.primary}22` },
                  ]}
                />
                {s.lottieSource ? (
                  <LottieHero
                    source={s.lottieSource}
                    style={styles.lottie}
                    reducedMotion={reduceMotion}
                    loop
                  />
                ) : (
                  <Text style={styles.emojiHero} accessibilityLabel="">
                    {s.emoji}
                  </Text>
                )}
              </Animated.View>
              <Text style={[styles.title, { color: c.text }]}>{s.title}</Text>
              <Text style={[styles.body, { color: c.textMuted }]}>{s.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {resolvedSlides.map((s, i) => (
          <Pressable
            key={s.key}
            hitSlop={8}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: SCREEN_W * i, animated: true });
              setPage(i);
            }}
            style={[
              styles.dot,
              {
                backgroundColor: i === page ? c.primary : c.border,
                width: i === page ? 26 : 8,
              },
            ]}
            accessibilityLabel={`Slide ${i + 1} of ${resolvedSlides.length}`}
          />
        ))}
      </View>

      <View style={[styles.footer, { backgroundColor: c.bg }]}>
        {page > 0 ? (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            style={[styles.backBtn, { borderColor: c.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button onPress={goNext}>
            {isLast
              ? t("onboarding.introButtonStart")
              : t("onboarding.introButtonNext")}
          </Button>
        </View>
      </View>
    </View>
  );
}

const HERO_SIZE = 220;

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  skipBtn: { minHeight: 32, justifyContent: "center" },
  skipText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
  page: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  heroWrap: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxl,
  },
  haloOuter: {
    position: "absolute",
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
  },
  haloInner: {
    position: "absolute",
    width: HERO_SIZE * 0.72,
    height: HERO_SIZE * 0.72,
    borderRadius: (HERO_SIZE * 0.72) / 2,
  },
  lottie: { width: 200, height: 180 },
  emojiHero: { fontSize: 108, lineHeight: 120 },
  title: {
    fontSize: typography.xxl,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: typography.base,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 340,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
