import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStreakItems, postStreakItem, queryKeys } from "@garzoni/core";
import GlassButton from "../ui/GlassButton";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

const FREEZE_COIN_COST = 10;

type Props = {
  visible: boolean;
  coinBalance: number;
  onDismiss: () => void;
  onStreakRestored: (newStreak: number) => void;
};

export default function StreakFreezeModal({
  visible,
  coinBalance,
  onDismiss,
  onStreakRestored,
}: Props) {
  const c = useThemeColors();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: queryKeys.streakItems(),
    queryFn: () => fetchStreakItems().then((r) => r.data?.items ?? []),
    enabled: visible,
    staleTime: 0,
  });

  const freezeCount =
    itemsQuery.data?.find((i) => i.type === "streak_freeze")?.quantity ?? 0;

  const canUseInventory = freezeCount > 0;
  const canUseCoins = !canUseInventory && coinBalance >= FREEZE_COIN_COST;
  const canRestore = canUseInventory || canUseCoins;

  const mutation = useMutation({
    mutationFn: () => postStreakItem("streak_freeze"),
    onSuccess: (res) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const data = res.data;
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.streakItems() });
      if (data.streak != null) onStreakRestored(data.streak);
      Toast.show({
        type: "success",
        text1: "Streak Restored!",
        text2:
          data.method === "coins"
            ? `Used ${FREEZE_COIN_COST} coins to restore your streak.`
            : "Your streak freeze saved the day!",
      });
      onDismiss();
    },
    onError: (err: unknown) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      Toast.show({
        type: "error",
        text1: "Couldn't restore streak",
        text2:
          code === "no_freezes_or_coins"
            ? "You need coins or a streak freeze."
            : "Something went wrong.",
      });
    },
  });

  const buttonLabel = canUseInventory
    ? `Use Streak Freeze (${freezeCount} left)`
    : canUseCoins
      ? `Restore with Coins (${FREEZE_COIN_COST} 🪙)`
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: "#000a" }]}
        onPress={onDismiss}
      >
        <Pressable
          style={styles.sheetWrap}
          onPress={(e) => e.stopPropagation()}
        >
          <Animated.View
            entering={SlideInDown.duration(280).easing(
              Easing.out(Easing.cubic),
            )}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={styles.emoji}>🧊</Text>
            <Text style={[styles.title, { color: c.text }]}>
              Your streak broke!
            </Text>
            <Text style={[styles.body, { color: c.textMuted }]}>
              You missed a day and lost your learning streak.
              {canUseInventory
                ? ` Use a Streak Freeze to restore it instantly.`
                : canUseCoins
                  ? ` Spend ${FREEZE_COIN_COST} coins to restore it.`
                  : ` Upgrade to Premium for unlimited Streak Freezes.`}
            </Text>

            <Text style={[styles.balance, { color: c.textMuted }]}>
              Balance: {coinBalance.toFixed(0)} 🪙{" "}
              {freezeCount > 0 ? `· ${freezeCount} ❄️` : ""}
            </Text>

            {canRestore && buttonLabel ? (
              <GlassButton
                variant="primary"
                onPress={() => mutation.mutate()}
                style={{ marginTop: spacing.lg }}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Restoring…" : buttonLabel}
              </GlassButton>
            ) : null}

            <GlassButton
              variant="secondary"
              onPress={() => {
                onDismiss();
                router.push("/subscriptions");
              }}
              style={{ marginTop: spacing.sm }}
            >
              Go Premium — Unlimited Freezes
            </GlassButton>

            <Pressable onPress={onDismiss} style={{ marginTop: spacing.md }}>
              <Text style={[styles.dismiss, { color: c.textMuted }]}>
                Not now
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheetWrap: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: "center",
  },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: {
    fontSize: typography.lg,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  balance: {
    fontSize: typography.xs,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  dismiss: {
    fontSize: typography.sm,
    textDecorationLine: "underline",
  },
});
