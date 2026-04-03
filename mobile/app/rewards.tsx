import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchProfile,
  fetchRewardsDonate,
  fetchRewardsShop,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import RewardCard, { type RewardItem } from "../src/components/rewards/RewardCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography } from "../src/theme/tokens";
import { Pressable } from "react-native";

export default function RewardsScreen() {
  const c = useThemeColors();
  const [tab, setTab] = useState<"shop" | "donate">("shop");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
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

  const balance = Number(profileQuery.data?.earned_money ?? 0) || 0;
  const data = tab === "shop" ? shopQuery.data ?? [] : donateQuery.data ?? [];
  const loading = tab === "shop" ? shopQuery.isPending : donateQuery.isPending;

  const onRefresh = useCallback(() => {
    void profileQuery.refetch();
    void shopQuery.refetch();
    void donateQuery.refetch();
  }, [profileQuery, shopQuery, donateQuery]);

  return (
    <>
      <Stack.Screen options={{ title: "Rewards", headerShown: true, headerTintColor: c.primary }} />
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Text style={[styles.balance, { color: c.text }]}>
          Coin balance: <Text style={{ color: c.accent, fontWeight: "800" }}>{balance}</Text>
        </Text>
        <View style={styles.tabs}>
          {(["shop", "donate"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderBottomWidth: 2,
                borderBottomColor: tab === t ? c.primary : "transparent",
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "700",
                  color: tab === t ? c.primary : c.textMuted,
                  textTransform: "capitalize",
                }}
              >
                {t === "shop" ? "Shop" : "Donate"}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? (
          <Text style={{ color: c.textMuted, textAlign: "center", marginTop: spacing.xl }}>
            Loading…
          </Text>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={{ gap: spacing.md }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            refreshControl={
              <RefreshControl refreshing={shopQuery.isFetching || donateQuery.isFetching} onRefresh={onRefresh} tintColor={c.primary} />
            }
            renderItem={({ item }) => (
              <View style={{ flex: 1, maxWidth: "48%" }}>
                <RewardCard item={item} balance={balance} />
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  balance: { padding: spacing.lg, fontSize: typography.md },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg },
});
