import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { FinanceFact, MissionActionKind } from "@garzoni/core";
import { useKeyboardBottomInset } from "../../hooks/useKeyboardBottomInset";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassButton from "../ui/GlassButton";
import { radius, spacing, typography } from "../../theme/tokens";
import CoinStack from "./CoinStack";
import FactCard from "./FactCard";

type Props = {
  kind: MissionActionKind | null;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onClose: () => void;
  // savings
  virtualBalance: number;
  savingsAmount: string;
  onSavingsAmountChange: (value: string) => void;
  onSavingsSubmit: () => void;
  // fact
  currentFact: FinanceFact | null;
  factLoading?: boolean;
  onMarkFactRead: () => void;
  onLoadFact: () => void;
};

/**
 * Centred pop-up for the two missions completed in-app rather than by
 * navigating away: the savings jar and the daily money fact.
 *
 * Centred rather than a bottom sheet on purpose — the savings form takes
 * keyboard input, and a bottom-anchored card gets pushed off-screen when the
 * keyboard opens. The card lifts by half the keyboard height instead, and
 * scrolls internally if it still doesn't fit.
 */
export default function MissionActionSheet({
  kind,
  isDaily,
  t,
  onClose,
  virtualBalance,
  savingsAmount,
  onSavingsAmountChange,
  onSavingsSubmit,
  currentFact,
  factLoading,
  onMarkFactRead,
  onLoadFact,
}: Props) {
  const c = useThemeColors();
  const visible = kind === "savings" || kind === "fact";
  const keyboardInset = useKeyboardBottomInset(visible);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { paddingBottom: keyboardInset / 2 }]}
        onPress={onClose}
      >
        <Pressable style={styles.cardWrap} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.title, { color: c.text }]}>
              {kind === "savings"
                ? t("missions.action.savingsTitle")
                : t("missions.action.factTitle")}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md }}
            >
              {kind === "savings" ? (
                <>
                  <CoinStack
                    balance={virtualBalance}
                    coinUnit={isDaily ? 1 : 10}
                    target={isDaily ? 10 : 100}
                    t={t}
                  />
                  <TextInput
                    value={savingsAmount}
                    onChangeText={onSavingsAmountChange}
                    placeholder={
                      isDaily
                        ? t("missions.savings.placeholderDaily")
                        : t("missions.savings.placeholderWeekly")
                    }
                    placeholderTextColor={c.textFaint}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      {
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                        color: c.text,
                      },
                    ]}
                  />
                  <GlassButton variant="primary" onPress={onSavingsSubmit}>
                    {t("missions.savings.add")}
                  </GlassButton>
                </>
              ) : (
                <FactCard
                  fact={currentFact}
                  loading={factLoading}
                  onMarkRead={onMarkFactRead}
                  onTryAgain={onLoadFact}
                  t={t}
                />
              )}
            </ScrollView>

            <GlassButton variant="ghost" onPress={onClose}>
              {t("missions.swap.cancel")}
            </GlassButton>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000a",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  cardWrap: { width: "100%", maxWidth: 460 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
    // Never taller than the visible area above the keyboard.
    maxHeight: "100%",
  },
  title: { fontSize: typography.md, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: typography.sm,
  },
});
