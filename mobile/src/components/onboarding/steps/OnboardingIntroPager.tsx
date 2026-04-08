import {
  useCallback,
  useEffect,
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
import { ImpactFeedbackStyle } from "expo-haptics";
import { safeImpactAsync } from "../../../utils/safeHaptics";
import LottieHero from "../../motion/LottieHero";
import { Button } from "../../ui";
import { colors, radius, spacing, typography } from "../../../theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");

export type IntroSlide = {
  key: string;
  title: string;
  body: string;
  emoji: string;
  /** Optional Lottie asset; omit to use emoji-only hero. */
  lottieSource?: ComponentProps<typeof LottieHero>["source"];
};

const DEFAULT_SLIDES: IntroSlide[] = [
  {
    key: "welcome",
    title: "Welcome to Garzoni",
    body: "Build real money skills with bite-sized lessons, quizzes, and practice.",
    emoji: "👋",
  },
  {
    key: "personalize",
    title: "Tailored for you",
    body: "Answer a few questions so we can match content to your goals and level.",
    emoji: "🎯",
  },
  {
    key: "earn",
    title: "Earn as you learn",
    body: "Collect XP, coins, and badges while you progress.",
    emoji: "⭐",
  },
];

type Props = {
  onDone: () => void;
  slides?: IntroSlide[];
};

export default function OnboardingIntroPager({
  onDone,
  slides = DEFAULT_SLIDES,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

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
      if (next !== page && next >= 0 && next < slides.length) {
        void safeImpactAsync(ImpactFeedbackStyle.Light);
        setPage(next);
      }
    },
    [page, slides.length],
  );

  const goNext = useCallback(() => {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: SCREEN_W * (page + 1), animated: true });
      setPage((p) => p + 1);
      void safeImpactAsync(ImpactFeedbackStyle.Light);
    } else {
      onDone();
    }
  }, [page, slides.length, onDone]);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        keyboardShouldPersistTaps="handled"
      >
        {slides.map((s) => (
          <View key={s.key} style={[styles.page, { width: SCREEN_W }]}>
            <View style={styles.hero}>
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
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((s, i) => (
          <Pressable
            key={s.key}
            hitSlop={8}
            onPress={() => {
              scrollRef.current?.scrollTo({ x: SCREEN_W * i, animated: true });
              setPage(i);
            }}
            style={[styles.dot, i === page && styles.dotActive]}
            accessibilityLabel={`Slide ${i + 1} of ${slides.length}`}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button onPress={goNext}>
          {page < slides.length - 1 ? "Next" : "Get started"}
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
  },
  lottie: { width: 200, height: 140 },
  emojiHero: { fontSize: 88, lineHeight: 100 },
  title: {
    fontSize: typography.xxl,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
