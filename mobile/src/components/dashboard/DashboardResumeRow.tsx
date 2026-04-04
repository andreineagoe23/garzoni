import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { ProgressSummary } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  resume?: ProgressSummary["resume"] | null;
  startHere?: ProgressSummary["start_here"] | null;
  /** Fills column height when used beside Practice card (dashboard two-up row). */
  style?: StyleProp<ViewStyle>;
};

export default function DashboardResumeRow({ resume, startHere, style }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  if (resume) {
    return (
      <GlassCard
        padding="md"
        fillContent
        style={[
          styles.card,
          { borderColor: c.primary, backgroundColor: c.primary + "18" },
          style,
        ]}
      >
        <View style={styles.column}>
          <View style={styles.body}>
            <View style={styles.iconRow}>
              <MaterialCommunityIcons name="book-open-variant" size={22} color={c.primary} />
              <View style={styles.copy}>
                <Text style={[styles.heading, { color: c.text }]} numberOfLines={2}>
                  {t("dashboard.resume.title")}
                </Text>
                <Text
                  style={[styles.detail, { color: c.textMuted }]}
                  numberOfLines={4}
                  ellipsizeMode="tail"
                >
                  {t("dashboard.resume.continueWith", { course: resume.course_title })}
                </Text>
              </View>
            </View>
          </View>
          <GlassButton
            variant="active"
            size="sm"
            style={styles.cta}
            onPress={() => router.push(`/flow/${resume.course_id}`)}
          >
            {t("dashboard.resume.continueLesson")}
          </GlassButton>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      padding="md"
      fillContent
      style={[styles.card, { borderColor: c.primary + "66" }, style]}
    >
      <View style={styles.column}>
        <View style={styles.body}>
          <View style={styles.iconRow}>
            <MaterialCommunityIcons name="book-open-variant" size={22} color={c.primary} />
            <View style={styles.copy}>
              <Text style={[styles.heading, { color: c.text }]} numberOfLines={2}>
                {t("dashboard.resume.title")}
              </Text>
              <Text
                style={[styles.detail, { color: c.textMuted }]}
                numberOfLines={4}
                ellipsizeMode="tail"
              >
                {t("dashboard.resume.startFirstLesson")}
              </Text>
            </View>
          </View>
        </View>
        <GlassButton
          variant="active"
          size="sm"
          style={styles.cta}
          onPress={() => {
            if (startHere?.course_id != null) {
              router.push(`/flow/${startHere.course_id}`);
            } else {
              router.push("/(tabs)/learn");
            }
          }}
        >
          {t("dashboard.resume.browseTopics")}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    flex: 1,
    minHeight: 168,
  },
  column: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 120,
  },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  heading: {
    fontSize: typography.sm,
    fontWeight: "800",
    lineHeight: 18,
  },
  detail: {
    fontSize: typography.xs,
    lineHeight: 18,
  },
  cta: { alignSelf: "stretch", marginTop: spacing.md },
});
