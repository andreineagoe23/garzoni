import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getMediaBaseUrl } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import type { RewardItem } from "./RewardCard";

type Props = {
  item: RewardItem | null;
  balance: number;
  isDonate: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmRedeemSheet({
  item,
  balance,
  isDonate,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  const c = useThemeColors();
  if (!item) return null;

  const cost = item.cost ?? 0;
  const canAfford = balance >= cost;
  const title = item.title || item.name || "Reward";

  const uri = item.image
    ? item.image.startsWith("http")
      ? item.image
      : `${getMediaBaseUrl()}/media/${item.image.replace(/^\/+/, "")}`
    : null;

  return (
    <Modal
      visible={item != null}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: c.border }]} />

          {/* Image */}
          {uri ? (
            <Image source={{ uri }} style={styles.img} resizeMode="cover" />
          ) : (
            <Text style={styles.emoji}>🎁</Text>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>

          {/* Description */}
          {item.description ? (
            <Text style={[styles.desc, { color: c.textMuted }]}>
              {item.description}
            </Text>
          ) : null}

          {/* Cost */}
          <View style={[styles.costRow, { backgroundColor: c.surfaceOffset, borderRadius: radius.full }]}>
            <Text style={[styles.costLabel, { color: c.textMuted }]}>Cost</Text>
            <Text style={[styles.costValue, { color: c.accent }]}>
              {cost} coins
            </Text>
          </View>

          {/* Balance */}
          <Text
            style={[
              styles.balance,
              { color: canAfford ? c.success : c.error },
            ]}
          >
            Your balance: {balance} coins
            {!canAfford ? "  (not enough)" : ""}
          </Text>

          {/* Confirm button */}
          <Pressable
            onPress={onConfirm}
            disabled={!canAfford || isPending}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                backgroundColor: c.primary,
                opacity: !canAfford || isPending ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            {isPending ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={[styles.confirmText, { color: c.textOnPrimary }]}>
                {isDonate ? "Donate" : "Buy Now"}
              </Text>
            )}
          </Pressable>

          {/* Cancel */}
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: c.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
    alignItems: "center",
    gap: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  img: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
  },
  emoji: { fontSize: 64 },
  title: {
    fontSize: typography.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  desc: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  costRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  costLabel: { fontSize: typography.sm },
  costValue: { fontSize: typography.base, fontWeight: "800" },
  balance: { fontSize: typography.sm, fontWeight: "600" },
  confirmBtn: {
    width: "100%",
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  confirmText: { fontSize: typography.base, fontWeight: "700" },
  cancelBtn: {
    paddingVertical: spacing.md,
    width: "100%",
    alignItems: "center",
  },
  cancelText: { fontSize: typography.base },
});
