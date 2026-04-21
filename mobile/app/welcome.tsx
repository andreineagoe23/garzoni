import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Button from "../src/components/ui/Button";
import { radius, shadows, spacing, typography } from "../src/theme/tokens";
import type { ThemeColors } from "../src/theme/palettes";
import { useThemeColors } from "../src/theme/ThemeContext";
import { setWelcomeSeen } from "../src/auth/firstRunFlags";

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  renderVisual: (c: ThemeColors) => ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: "learn",
    title: "Learn finance that actually sticks",
    subtitle:
      "Build streaks, earn XP, and progress through guided lessons designed for daily momentum.",
    renderVisual: (color) => (
      <View style={styles.learnStack}>
        <MaterialCommunityIcons name="trophy" size={84} color={color.primary} />
        <View
          style={[
            styles.streakChip,
            { backgroundColor: color.surface, borderColor: color.primary },
          ]}
        >
          <MaterialCommunityIcons name="fire" size={14} color={color.primary} />
          <Text style={[styles.streakText, { color: color.primary }]}>
            Day 3 · 120 XP
          </Text>
        </View>
      </View>
    ),
  },
  {
    id: "tools",
    title: "AI-powered tools for your money",
    subtitle:
      "Use calculators, simulations, and guided insights to practice smarter decisions with confidence.",
    renderVisual: (color) => (
      <View style={styles.toolsGrid}>
        {[
          "calculator-variant-outline",
          "chart-line",
          "wallet-outline",
          "lightbulb-on-outline",
        ].map((icon) => (
          <View
            key={icon}
            style={[
              styles.toolCard,
              {
                backgroundColor: color.surface,
                borderColor: color.border,
                ...shadows.sm,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={icon as never}
              size={30}
              color={color.primary}
            />
          </View>
        ))}
      </View>
    ),
  },
  {
    id: "plans",
    title: "Start free. Upgrade when it fits.",
    subtitle:
      "Tap a plan to see what you unlock. Starter is free forever.",
    renderVisual: (color) => <PlansVisual c={color} />,
  },
];

type TierId = "starter" | "plus" | "pro";
const TIERS: Array<{
  id: TierId;
  label: string;
  hint: string;
  features: string[];
}> = [
  {
    id: "starter",
    label: "Starter",
    hint: "Free forever",
    features: [
      "Core lessons & daily streaks",
      "Basic XP, coins, and badges",
      "Leaderboards and missions",
    ],
  },
  {
    id: "plus",
    label: "Plus",
    hint: "Personalized path",
    features: [
      "Tailored learning path",
      "Expanded lesson library",
      "Priority AI tutor chats",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    hint: "Full toolkit",
    features: [
      "Full financial toolkit",
      "Advanced simulations & analytics",
      "Early access to new tools",
    ],
  },
];

function PlansVisual({ c }: { c: ThemeColors }) {
  const [selected, setSelected] = useState<TierId>("starter");
  const active = TIERS.find((t) => t.id === selected) ?? TIERS[0];
  return (
    <View style={styles.plansWrap}>
      <View style={styles.tierList}>
        {TIERS.map((t) => {
          const isActive = t.id === selected;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSelected(t.id)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${t.label} plan`}
              style={[
                styles.tierRow,
                {
                  backgroundColor: isActive ? c.surface : "transparent",
                  borderColor: isActive ? c.primary : c.border,
                },
              ]}
            >
              <View
                style={[
                  styles.tierDot,
                  { backgroundColor: isActive ? c.primary : c.border },
                ]}
              />
              <Text
                style={[
                  styles.tierLabel,
                  { color: isActive ? c.primary : c.text },
                ]}
              >
                {t.label}
              </Text>
              <Text style={[styles.tierHint, { color: c.textMuted }]}>
                {t.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.featureList}>
        {active.features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={14}
              color={c.primary}
            />
            <Text style={[styles.featureText, { color: c.textMuted }]}>
              {f}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex, scale, opacity]);

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 70 }),
    [],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next = viewableItems[0]?.index;
      if (typeof next === "number") setActiveIndex(next);
    },
  ).current;

  const last = activeIndex === SLIDES.length - 1;

  const markSeenAndGo = async (href: "/login" | "/register") => {
    await setWelcomeSeen();
    router.replace(href);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => void markSeenAndGo("/login")} hitSlop={10}>
          <Text style={[styles.skip, { color: c.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex;
          return (
            <View style={[styles.slide, { width }]}>
              <Animated.View
                style={[
                  styles.visualShell,
                  isActive && {
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              >
                {item.renderVisual(c)}
              </Animated.View>
              <Text style={[styles.title, { color: c.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                {item.subtitle}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.pagination}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              {
                width: i === activeIndex ? 26 : 8,
                backgroundColor: i === activeIndex ? c.primary : c.border,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          size="lg"
          onPress={() => {
            if (last) {
              void markSeenAndGo("/register");
              return;
            }
            listRef.current?.scrollToIndex({
              index: activeIndex + 1,
              animated: true,
            });
          }}
        >
          {last ? "Get started" : "Continue"}
        </Button>

        <Pressable onPress={() => void markSeenAndGo("/login")} hitSlop={10}>
          <Text style={[styles.loginLink, { color: c.textMuted }]}>
            Already have an account?{" "}
            <Text style={{ color: c.primary }}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const SHELL_H = 300;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: "flex-end",
  },
  skip: { fontSize: typography.sm, fontWeight: "600" },
  slide: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: "center",
  },
  visualShell: {
    width: "100%",
    height: SHELL_H,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
learnStack: { alignItems: "center", gap: spacing.md },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    ...shadows.sm,
  },
  streakText: { fontSize: typography.sm, fontWeight: "800" },
  toolsGrid: {
    width: 180,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  toolCard: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  plansWrap: {
    width: "92%",
    gap: spacing.md,
  },
  tierList: {
    gap: spacing.xs,
  },
  featureList: {
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  featureText: {
    fontSize: typography.sm,
    flex: 1,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierLabel: { fontSize: typography.sm, fontWeight: "800" },
  tierHint: { flex: 1, fontSize: typography.xs, textAlign: "right" },
  title: {
    fontSize: typography.xxl,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.base,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 340,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: { height: 8, borderRadius: radius.full },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loginLink: { textAlign: "center", fontSize: typography.sm },
});
