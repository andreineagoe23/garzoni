import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  balance: number;
  coinUnit?: number;
  target?: number;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export default function CoinStack({
  balance,
  coinUnit = 10,
  target = 100,
  t,
}: Props) {
  const c = useThemeColors();
  const steps = Math.max(1, Math.floor(target / coinUnit));
  const coins = Array.from({ length: steps }, (_, i) => (i + 1) * coinUnit);
  const unlockedCoins = Math.floor(balance / coinUnit);
  const remainder = balance % coinUnit;
  const toNext = remainder === 0 ? coinUnit : coinUnit - remainder;

  return (
    <GlassCard padding="md" style={{ backgroundColor: `${c.bg}99` }}>
      <View style={styles.grid}>
        {coins.map((amount, index) => {
          const unlocked = index < unlockedCoins;
          return (
            <View
              key={amount}
              style={[
                styles.coin,
                {
                  borderColor: unlocked ? c.primarySoft : c.border,
                  backgroundColor: unlocked ? c.successBg : c.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.coinAmt,
                  { color: unlocked ? c.primaryBright : c.textMuted },
                ]}
              >
                £{amount}
              </Text>
              <Text style={[styles.coinLabel, { color: c.textMuted }]}>
                {unlocked
                  ? t("missions.savings.unlocked")
                  : t("missions.savings.locked")}
              </Text>
            </View>
          );
        })}
      </View>
      {balance < target ? (
        <View
          style={[
            styles.nextHint,
            { borderColor: `${c.accent}66`, backgroundColor: `${c.accent}18` },
          ]}
        >
          <Text style={[styles.nextHintText, { color: c.accent }]}>
            {t("missions.savings.nextCoin", { amount: toNext })}
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  coin: {
    width: "30%",
    minWidth: 88,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  coinAmt: { fontSize: typography.sm, fontWeight: "700" },
  coinLabel: { marginTop: 4, fontSize: 10, fontWeight: "600" },
  nextHint: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  nextHintText: {
    fontSize: typography.xs,
    fontWeight: "600",
    textAlign: "center",
  },
});
