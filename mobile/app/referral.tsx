import { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fetchProfile, queryKeys, staleTimes } from "@garzoni/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import GlassCard from "../src/components/ui/GlassCard";
import GlassButton from "../src/components/ui/GlassButton";

export default function ReferralScreen() {
  const c = useThemeColors();

  const profileQ = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const referralCode = String(
    (profileQ.data as { referral_code?: string } | undefined)?.referral_code ??
      "",
  );

  const onCopy = useCallback(async () => {
    if (!referralCode) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Share.share({ message: referralCode });
  }, [referralCode]);

  const onShare = useCallback(async () => {
    if (!referralCode) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join me on Garzoni — the financial literacy app! Use my referral code: ${referralCode}`,
    });
  }, [referralCode]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Refer a Friend",
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      >
        <Text style={[styles.heading, { color: c.text }]}>Invite a Friend</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Share your referral code with friends. When they sign up, you both
          benefit.
        </Text>

        {referralCode ? (
          <GlassCard padding="lg" style={styles.codeCard}>
            <Text style={[styles.codeLabel, { color: c.textMuted }]}>
              Your referral code
            </Text>
            <Pressable onPress={() => void onCopy()} accessibilityRole="button">
              <Text style={[styles.code, { color: c.accent }]}>
                {referralCode}
              </Text>
              <Text style={[styles.tapHint, { color: c.textFaint }]}>
                Tap to share
              </Text>
            </Pressable>
          </GlassCard>
        ) : (
          <GlassCard padding="lg" style={styles.codeCard}>
            <Text style={[styles.codeLabel, { color: c.textMuted }]}>
              {profileQ.isPending
                ? "Loading your code…"
                : "No referral code available yet."}
            </Text>
          </GlassCard>
        )}

        <View style={styles.actions}>
          <GlassButton
            variant="active"
            size="lg"
            onPress={() => void onShare()}
            disabled={!referralCode}
          >
            Share with Friends
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="md"
            onPress={() => void onCopy()}
            disabled={!referralCode}
          >
            Copy Code
          </GlassButton>
        </View>

        <Text style={[styles.legal, { color: c.textFaint }]}>
          Referral rewards are subject to terms and conditions. Both parties
          must complete registration for the reward to be applied.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  heading: {
    fontSize: typography.xl,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.base,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  codeCard: {
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  codeLabel: { fontSize: typography.sm, fontWeight: "600" },
  code: {
    fontSize: typography.xxl,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },
  tapHint: {
    fontSize: typography.xs,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  actions: { gap: spacing.sm, marginBottom: spacing.xl },
  legal: {
    fontSize: typography.xs,
    lineHeight: 16,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
