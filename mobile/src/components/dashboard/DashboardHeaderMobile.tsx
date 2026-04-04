import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  displayName?: string;
};

export default function DashboardHeaderMobile({ displayName }: Props) {
  const { t } = useTranslation("common");
  const c = useThemeColors();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: c.primary }]}>
        <Text style={styles.avatarEmoji} accessibilityLabel="">
          👋
        </Text>
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: c.text }]}>
          {displayName
            ? t("dashboard.header.welcomeBackName", { name: displayName })
            : `${t("dashboard.header.welcomeBack")}!`}
        </Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t("dashboard.header.yourCoachSubtitle")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 22 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4, lineHeight: 20 },
});
