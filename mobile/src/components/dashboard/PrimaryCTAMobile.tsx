import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassButton from "../ui/GlassButton";
import { spacing, typography, radius } from "../../theme/tokens";

export type PrimaryCtaMobileData = {
  text: string;
  action: () => void;
  iconName?: "book" | "bookOpen" | "rocket";
  priority?: "high" | "medium" | "low";
  reason?: string;
};

const ICON_MAP = {
  book: "book-outline" as const,
  bookOpen: "book-open-variant" as const,
  rocket: "rocket-launch" as const,
};

type Props = {
  primaryCTA?: PrimaryCtaMobileData | null;
};

export default function PrimaryCTAMobile({ primaryCTA }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  if (!primaryCTA) return null;

  const border =
    primaryCTA.priority === "high"
      ? `${c.error}66`
      : primaryCTA.priority === "medium"
        ? `${c.primary}66`
        : c.border;
  const bg =
    primaryCTA.priority === "high"
      ? `${c.error}18`
      : primaryCTA.priority === "medium"
        ? `${c.primary}14`
        : c.surface;

  const icon = primaryCTA.iconName ? ICON_MAP[primaryCTA.iconName] : undefined;

  return (
    <View style={[styles.wrap, { borderColor: border, backgroundColor: bg }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {icon ? (
            <MaterialCommunityIcons name={icon} size={24} color={c.primary} />
          ) : null}
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: c.text }]}>
              {primaryCTA.text}
            </Text>
            <Text style={[styles.reason, { color: c.textMuted }]}>
              {primaryCTA.reason || t("dashboard.primaryCta.continueReason")}
            </Text>
          </View>
        </View>
        <GlassButton variant="primary" size="md" onPress={primaryCTA.action}>
          {t("dashboard.primaryCta.getStarted")}
        </GlassButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: typography.sm, fontWeight: "800" },
  reason: { fontSize: typography.xs, marginTop: 4, lineHeight: 18 },
});
