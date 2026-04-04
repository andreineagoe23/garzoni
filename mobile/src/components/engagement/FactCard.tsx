import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { FinanceFact } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  fact: FinanceFact | null;
  loading?: boolean;
  onMarkRead: () => void;
  onTryAgain?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export default function FactCard({
  fact,
  loading,
  onMarkRead,
  onTryAgain,
  t,
}: Props) {
  const c = useThemeColors();
  return (
    <GlassCard padding="md">
      {fact ? (
        <>
          {fact.category ? (
            <Text style={[styles.category, { color: c.accent }]}>{fact.category}</Text>
          ) : null}
          <Text style={[styles.fact, { color: c.text }]}>{fact.text}</Text>
          <Pressable
            onPress={onMarkRead}
            style={({ pressed }) => [
              styles.markBtn,
              { opacity: pressed ? 0.85 : 1, backgroundColor: "#10b981" },
            ]}
          >
            <Text style={styles.markBtnText}>{t("missions.facts.markRead")}</Text>
          </Pressable>
        </>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.empty, { color: c.textMuted, marginLeft: spacing.sm }]}>
            {t("missions.facts.loading")}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.empty, { color: c.textMuted }]}>
            {t("missions.facts.empty")}
          </Text>
          {onTryAgain ? (
            <Pressable onPress={onTryAgain} style={{ marginTop: spacing.md }}>
              <Text style={{ color: c.accent, fontWeight: "600" }}>
                {t("missions.facts.tryAgain")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: "row", alignItems: "center" },
  category: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  fact: { fontSize: typography.sm, lineHeight: 22 },
  empty: { fontSize: typography.sm, lineHeight: 20 },
  markBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  markBtnText: {
    color: "#fff",
    fontSize: typography.xs,
    fontWeight: "700",
  },
});
