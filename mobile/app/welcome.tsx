import { useMemo, useRef, useState, type ReactNode } from "react";
import {
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
import { radius, spacing, typography } from "../src/theme/tokens";
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
      <View style={styles.visualRow}>
        <MaterialCommunityIcons name="fire" size={40} color={color.primary} />
        <MaterialCommunityIcons
          name="trophy-outline"
          size={40}
          color={color.primary}
        />
        <MaterialCommunityIcons
          name="star-four-points"
          size={40}
          color={color.primary}
        />
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
              { borderColor: `${color.primary}44` },
            ]}
          >
            <MaterialCommunityIcons name={icon as never} size={24} color={color.primary} />
          </View>
        ))}
      </View>
    ),
  },
  {
    id: "plans",
    title: "Free to start. Upgrade when it fits.",
    subtitle:
      "Starter stays free forever. Plus unlocks your personalized path and deeper lessons. Pro adds the full toolkit and richer progress insights.",
    renderVisual: (theme) => (
      <View style={styles.planColumn}>
        <View
          style={[
            styles.planChip,
            {
              borderColor: theme.primary,
              backgroundColor: theme.surfaceOffset,
            },
          ]}
        >
          <Text style={[styles.planChipText, { color: theme.primary }]}>
            Starter · Free forever
          </Text>
        </View>
        <Text style={[styles.planHint, { color: theme.textMuted }]}>
          Plus: personalized path and expanded practice. Pro: every tool plus
          deeper analytics.
        </Text>
      </View>
    ),
  },
];

export default function WelcomeScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.visualShell, { backgroundColor: c.surface }]}>
              {item.renderVisual(c)}
            </View>
            <Text style={[styles.title, { color: c.text }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      <View style={styles.pagination}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              {
                width: i === activeIndex ? 22 : 8,
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
            listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
          }}
        >
          {last ? "Get started" : "Continue"}
        </Button>

        <Pressable onPress={() => void markSeenAndGo("/login")} hitSlop={10}>
          <Text style={[styles.loginLink, { color: c.textMuted }]}>
            Already have an account? <Text style={{ color: c.primary }}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
    minHeight: 220,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  visualRow: { flexDirection: "row", gap: spacing.md },
  toolsGrid: {
    width: "82%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  toolCard: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  planColumn: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  planChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  planChipText: { fontSize: typography.sm, fontWeight: "700" },
  planHint: {
    fontSize: typography.xs,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 300,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
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
    marginTop: spacing.xl,
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
