import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getToolLearningHook } from "@garzoni/core";
import { href } from "../../navigation/href";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

type Props = {
  toolSlug: string;
};

export default function WhyThisMattersMobile({ toolSlug }: Props) {
  const c = useThemeColors();
  const hook = getToolLearningHook(toolSlug);
  if (!hook) return null;

  const exerciseRoute = hook.exerciseRoute.replace(
    /^\/exercises/,
    "/(tabs)/exercises",
  );
  const lessonRoute = hook.lessonRoute.replace(
    /^\/all-topics/,
    "/(tabs)/learn",
  );

  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surfaceOffset },
      ]}
    >
      <Text style={[styles.eyebrow, { color: c.primary }]}>{hook.title}</Text>
      <Text style={[styles.body, { color: c.textMuted }]}>
        {hook.explainer}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(href(lessonRoute))}
          style={[styles.secondary, { borderColor: c.border }]}
        >
          <Text style={[styles.secondaryText, { color: c.text }]}>Learn</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(href(exerciseRoute))}
          style={[styles.primary, { backgroundColor: c.primary }]}
        >
          <Text style={styles.primaryText}>Practice</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    fontSize: typography.sm,
    fontWeight: "800",
  },
  primary: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryText: {
    color: "white",
    fontSize: typography.sm,
    fontWeight: "800",
  },
});
