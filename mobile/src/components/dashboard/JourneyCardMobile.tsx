import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WhatsNextAction } from "@garzoni/core";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

type Props = {
  action?: WhatsNextAction | null;
  isLoading?: boolean;
  onAction: (action: WhatsNextAction) => void;
};

const ICON_BY_TYPE: Record<string, string> = {
  review: "🔥",
  practice: "💪",
  lesson: "📖",
  quiz: "🎯",
  tutor: "🤖",
  tool_followup: "🛠️",
  resume: "🚀",
  start: "📚",
  explore: "💡",
};

export default function JourneyCardMobile({
  action,
  isLoading,
  onAction,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const icon = ICON_BY_TYPE[action?.type || "explore"] || "🚀";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceOffset, borderColor: c.border },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: c.primary }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: c.primary }]}>
          {t("dashboard.journey.eyebrow", {
            defaultValue: "Continue your journey",
          })}
        </Text>
        <Text style={[styles.title, { color: c.text }]}>
          {isLoading
            ? t("dashboard.journey.loadingTitle", {
                defaultValue: "Finding your next step...",
              })
            : action?.title ||
              t("dashboard.journey.fallbackTitle", {
                defaultValue: "Choose your next topic",
              })}
        </Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {isLoading
            ? t("dashboard.journey.loadingSubtitle", {
                defaultValue:
                  "Garzoni is checking your lessons, reviews, and practice.",
              })
            : action?.subtitle ||
              t("dashboard.journey.fallbackSubtitle", {
                defaultValue: "Browse the course library and start learning.",
              })}
        </Text>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onAction(action)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.primary, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Text style={styles.buttonText}>
            {t("dashboard.journey.cta", { defaultValue: "Continue" })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 22,
  },
  copy: {
    gap: 3,
  },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "800",
    lineHeight: 28,
  },
  subtitle: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    color: "white",
    fontSize: typography.sm,
    fontWeight: "800",
  },
});
