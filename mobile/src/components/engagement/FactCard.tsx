import { Pressable, StyleSheet, Text } from "react-native";
import type { FinanceFact } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  fact: FinanceFact | null;
  loading?: boolean;
  onRefresh?: () => void;
};

export default function FactCard({ fact, loading, onRefresh }: Props) {
  const c = useThemeColors();
  return (
    <GlassCard padding="md">
      <Text style={[styles.kicker, { color: c.textMuted }]}>Did you know?</Text>
      {loading && !fact ? (
        <Text style={{ color: c.textMuted }}>Loading fact…</Text>
      ) : fact ? (
        <Text style={[styles.fact, { color: c.text }]}>{fact.text}</Text>
      ) : (
        <Text style={{ color: c.textMuted }}>No fact available right now.</Text>
      )}
      {onRefresh ? (
        <Pressable onPress={onRefresh} style={{ marginTop: spacing.md }}>
          <Text style={{ color: c.primary, fontWeight: "600" }}>New fact</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  fact: { fontSize: typography.base, lineHeight: 22 },
});
