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
  Dimensions,
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
  /** Optional Lottie asset; omit to use emoji-only hero. */
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

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / SCREEN_W);
      if (
        next !== page &&
        next >= 0 &&
        next < resolvedSlides.length
      ) {
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

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {resolvedSlides.map((s) => (
          <View key={s.key} style={[styles.page, { width: SCREEN_W }]}>
            <View style={[styles.hero, { backgroundColor: c.surface }]}>
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
            </View>
            <Text style={[styles.title, { color: c.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: c.textMuted }]}>{s.body}</Text>
          </View>
        ))}
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
                width: i === page ? 22 : 8,
              },
            ]}
            accessibilityLabel={`Slide ${i + 1} of ${resolvedSlides.length}`}
          />
        ))}
      </View>

      <View style={[styles.footer, { backgroundColor: c.bg }]}>
        <Button onPress={goNext}>
          {page < resolvedSlides.length - 1
            ? t("onboarding.introButtonNext")
            : t("onboarding.introButtonStart")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
  hero: {
    minHeight: 140,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
  },
  lottie: { width: 200, height: 140 },
  emojiHero: { fontSize: 88, lineHeight: 100 },
  title: {
    fontSize: typography.xxl,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
