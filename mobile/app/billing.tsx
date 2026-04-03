import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchEntitlements,
  fetchProfile,
  postSubscriptionPortal,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography } from "../src/theme/tokens";

export default function BillingScreen() {
  const c = useThemeColors();
  const [err, setErr] = useState("");

  const profileQ = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const entQ = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });

  const portalMutation = useMutation({
    mutationFn: postSubscriptionPortal,
    onSuccess: async (res) => {
      const url = res.data?.url;
      if (url) {
        const ok = await Linking.canOpenURL(url);
        if (ok) await Linking.openURL(url);
        else Alert.alert("Billing", "Could not open billing portal URL.");
      } else {
        setErr("No portal URL returned.");
      }
    },
    onError: () => setErr("Could not open customer portal."),
  });

  const onPortal = useCallback(() => {
    setErr("");
    portalMutation.mutate();
  }, [portalMutation]);

  const plan = entQ.data?.plan ?? "starter";
  const status = entQ.data?.status ?? "inactive";
  const label = entQ.data?.label ?? plan;

  return (
    <>
      <Stack.Screen options={{ title: "Billing", headerShown: true, headerTintColor: c.primary }} />
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <GlassCard padding="lg">
          <Text style={[styles.title, { color: c.text }]}>Subscription</Text>
          <Text style={[styles.row, { color: c.textMuted }]}>Plan: {label}</Text>
          <Text style={[styles.row, { color: c.textMuted }]}>Status: {status}</Text>
          {profileQ.data?.has_paid === false && plan === "starter" ? (
            <Text style={[styles.hint, { color: c.accent }]}>
              Upgrade on the web for full access — open the customer portal to manage an existing subscription.
            </Text>
          ) : null}
        </GlassCard>

        {err ? <Text style={{ color: c.error, marginTop: spacing.md }}>{err}</Text> : null}

        <View style={{ marginTop: spacing.xl }}>
          <GlassButton variant="active" size="lg" onPress={onPortal} loading={portalMutation.isPending}>
            Manage subscription (Stripe)
          </GlassButton>
        </View>

        <Text style={[styles.note, { color: c.textFaint }]}>
          After checkout on the web, pull to refresh profile to update your plan.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  title: { fontSize: typography.lg, fontWeight: "800", marginBottom: spacing.md },
  row: { fontSize: typography.sm, marginBottom: 4 },
  hint: { fontSize: typography.sm, marginTop: spacing.md, lineHeight: 20 },
  note: { fontSize: typography.xs, marginTop: spacing.xl, lineHeight: 18 },
});
