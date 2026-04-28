import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import {
  fetchBadges,
  fetchProfile,
  fetchRewardsDonate,
  fetchRewardsShop,
  fetchUserBadges,
  purchaseReward,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import RewardCard, {
  type RewardItem,
} from "../src/components/rewards/RewardCard";
import BadgeGrid from "../src/components/rewards/BadgeGrid";
import XPProgressCard from "../src/components/rewards/XPProgressCard";
import ConfirmRedeemSheet from "../src/components/rewards/ConfirmRedeemSheet";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography } from "../src/theme/tokens";

export default function RewardsScreen() {
  const c = useThemeColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"shop" | "donate">("shop");
  const [confirmItem, setConfirmItem] = useState<RewardItem | null>(null);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const badgesCatalogQuery = useQuery({
    queryKey: queryKeys.badgesCatalog(),
    queryFn: () => fetchBadges().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const userBadgesQuery = useQuery({
    queryKey: queryKeys.userBadges(),
    queryFn: () => fetchUserBadges().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const shopQuery = useQuery({
    queryKey: queryKeys.rewardsShop(),
    queryFn: () => fetchRewardsShop().then((r) => r.data as RewardItem[]),
    staleTime: staleTimes.progressSummary,
  });

  const donateQuery = useQuery({
    queryKey: queryKeys.rewardsDonate(),
    queryFn: () => fetchRewardsDonate().then((r) => r.data as RewardItem[]),
    staleTime: staleTimes.progressSummary,
  });

  const purchaseMutation = useMutation({
    mutationFn: (rewardId: number | string) => purchaseReward(rewardId),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      setConfirmItem(null);
      Toast.show({
        type: "success",
        text1: tab === "donate" ? "Donation sent!" : "Reward redeemed!",
        text2: "Your balance has been updated.",
      });
    },
    onError: (err: unknown) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Something went wrong. Please try again.";
      Toast.show({ type: "error", text1: "Failed", text2: msg });
    },
  });

  const balance = Number(profileQuery.data?.earned_money ?? 0) || 0;
  const points = Number(profileQuery.data?.points ?? 0) || 0;
  const data =
    tab === "shop" ? (shopQuery.data ?? []) : (donateQuery.data ?? []);
  const tabLoading =
    tab === "shop" ? shopQuery.isPending : donateQuery.isPending;

  const onRefresh = useCallback(() => {
    void profileQuery.refetch();
    void shopQuery.refetch();
    void donateQuery.refetch();
    void badgesCatalogQuery.refetch();
    void userBadgesQuery.refetch();
  }, [
    profileQuery,
    shopQuery,
    donateQuery,
    badgesCatalogQuery,
    userBadgesQuery,
  ]);

  const refreshing =
    shopQuery.isFetching ||
    donateQuery.isFetching ||
    profileQuery.isFetching ||
    badgesCatalogQuery.isFetching ||
    userBadgesQuery.isFetching;

  const listHeader = (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.balance, { color: c.text }]}>
        Coin balance:{" "}
        <Text style={{ color: c.accent, fontWeight: "800" }}>{balance}</Text>
      </Text>
      <XPProgressCard points={points} />
      <View style={{ marginTop: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Badges</Text>
        <BadgeGrid
          catalog={badgesCatalogQuery.data ?? []}
          earned={userBadgesQuery.data ?? []}
        />
      </View>
      <Pressable
        onPress={() => router.push("/leaderboard")}
        style={[
          styles.lbLink,
          { borderColor: c.primary, backgroundColor: `${c.primary}12` },
        ]}
      >
        <Text
          style={{
            color: c.primary,
            fontWeight: "800",
            fontSize: typography.sm,
          }}
        >
          View leaderboard
        </Text>
      </Pressable>
      <View style={styles.tabs}>
        {(["shop", "donate"] as const).map((tabId) => (
          <Pressable
            key={tabId}
            onPress={() => setTab(tabId)}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              borderBottomWidth: 2,
              borderBottomColor: tab === tabId ? c.primary : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "700",
                color: tab === tabId ? c.primary : c.textMuted,
                textTransform: "capitalize",
              }}
            >
              {tabId === "shop" ? "Shop" : "Donate"}
            </Text>
          </Pressable>
        ))}
      </View>
      {tabLoading ? (
        <Text
          style={{
            color: c.textMuted,
            textAlign: "center",
            marginTop: spacing.lg,
          }}
        >
          Loading…
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Rewards",
          headerShown: true,
        }}
      />
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <FlatList
          data={tabLoading ? [] : data}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={
            data.length && !tabLoading ? { gap: spacing.md } : undefined
          }
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: spacing.xxxl,
          }}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: "48%" }}>
              <RewardCard
                item={item}
                balance={balance}
                isDonate={tab === "donate"}
                onPress={(selected) => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setConfirmItem(selected);
                }}
              />
            </View>
          )}
          ListEmptyComponent={
            !tabLoading ? (
              <Text
                style={{
                  color: c.textMuted,
                  textAlign: "center",
                  marginTop: spacing.md,
                }}
              >
                Nothing here yet.
              </Text>
            ) : null
          }
        />
      </View>

      <ConfirmRedeemSheet
        item={confirmItem}
        balance={balance}
        isDonate={tab === "donate"}
        isPending={purchaseMutation.isPending}
        onConfirm={() => {
          if (confirmItem) {
            purchaseMutation.mutate(confirmItem.id);
          }
        }}
        onCancel={() => setConfirmItem(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  balance: { fontSize: typography.md, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  lbLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  tabs: { flexDirection: "row", marginTop: spacing.lg },
});
