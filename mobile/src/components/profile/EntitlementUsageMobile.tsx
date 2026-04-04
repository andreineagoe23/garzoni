import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ThemeColors } from "../../theme/palettes";
import { spacing, typography, radius } from "../../theme/tokens";

export type EntitlementUsageItem = {
  key: string | number;
  name?: string;
  enabled?: boolean;
  used?: number;
  remaining?: number | null;
};

export default function EntitlementUsageMobile({
  items,
  colors,
}: {
  items: EntitlementUsageItem[];
  colors: ThemeColors;
}) {
  const { t } = useTranslation("common");
  if (!items.length) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("dashboard.entitlementUsage.dailyUsage")}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {t("dashboard.entitlementUsage.resetsDaily")}
        </Text>
      </View>
      <View style={styles.grid}>
        {items.map((feature) => {
          const remaining =
            feature.remaining === null || feature.remaining === undefined
              ? null
              : Math.max(feature.remaining, 0);
          const used = feature.used ?? 0;
          return (
            <View
              key={String(feature.key)}
              style={[
                styles.card,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceOffset,
                },
              ]}
            >
              <Text style={[styles.name, { color: colors.text }]}>{feature.name}</Text>
              {feature.enabled === false ? (
                <Text style={[styles.detail, { color: colors.error }]}>
                  {t("dashboard.entitlementUsage.lockedUpgrade")}
                </Text>
              ) : (
                <Text style={[styles.detail, { color: colors.textMuted }]}>
                  {remaining === null
                    ? `${used} ${t("dashboard.entitlementUsage.unlimited")}`
                    : t("dashboard.entitlementUsage.usedRemaining", {
                        used,
                        remaining,
                      })}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  title: { fontSize: typography.sm, fontWeight: "700" },
  sub: { fontSize: typography.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: {
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
  },
  name: { fontSize: typography.sm, fontWeight: "600" },
  detail: { fontSize: typography.xs, marginTop: 4 },
});
