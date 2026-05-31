import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  fetchActiveDuels,
  fetchDuelHistory,
  fetchProfile,
  queryKeys,
  staleTimes,
  type DuelRecord,
  type UserProfile,
} from "@garzoni/core";
import { useThemeColors } from "../../src/theme/ThemeContext";
import GlassCard from "../../src/components/ui/GlassCard";
import { Skeleton } from "../../src/components/ui";
import { spacing, typography, radius } from "../../src/theme/tokens";
import DuelCard from "../../src/components/duels/DuelCard";

type Tab = "active" | "history";

export default function DuelsScreen() {
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const [tab, setTab] = useState<Tab>("active");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
  });
  const currentUserId = profileQuery.data?.id
    ? Number(profileQuery.data.id)
    : null;

  const activeQuery = useQuery({
    queryKey: queryKeys.duelsActive(),
    queryFn: () => fetchActiveDuels().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: tab === "active" ? 30_000 : false,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.duelsHistory(),
    queryFn: () => fetchDuelHistory().then((r) => r.data),
    staleTime: 60_000,
    enabled: tab === "history",
  });

  const data = useMemo<DuelRecord[]>(() => {
    const list = tab === "active" ? activeQuery.data : historyQuery.data;
    return list ?? [];
  }, [tab, activeQuery.data, historyQuery.data]);

  const loading =
    tab === "active"
      ? activeQuery.isPending && !activeQuery.data
      : historyQuery.isPending && !historyQuery.data;

  const refreshing =
    tab === "active" ? activeQuery.isFetching : historyQuery.isFetching;

  const onRefresh = () => {
    if (tab === "active") void activeQuery.refetch();
    else void historyQuery.refetch();
  };

  return (
    <>
      <Stack.Screen options={{ title: t("duels.title"), headerShown: true }} />
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.headerPad}>
          <Text style={[styles.h1, { color: c.text }]}>{t("duels.title")}</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t("duels.subtitle")}
          </Text>

          <View
            style={[
              styles.tabBar,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            {(["active", "history"] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: tab === key ? c.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "700",
                    fontSize: typography.sm,
                    color: tab === key ? c.textOnPrimary : c.textMuted,
                  }}
                >
                  {t(`duels.tabs.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FlatList
          data={data}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
          renderItem={({ item }) => (
            <DuelCard
              duel={item}
              currentUserId={currentUserId}
              onPress={() => router.push(`/duels/${item.id}`)}
              t={t}
              locale={i18n.language}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    width="100%"
                    height={120}
                    borderRadius={radius.lg}
                  />
                ))}
              </View>
            ) : (
              <GlassCard
                padding="lg"
                style={{
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  marginTop: spacing.lg,
                }}
              >
                <Text
                  style={{
                    color: c.textMuted,
                    textAlign: "center",
                    fontSize: typography.sm,
                  }}
                >
                  {t(`duels.empty.${tab}`)}
                </Text>
              </GlassCard>
            )
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerPad: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  h1: { fontSize: typography.xl, fontWeight: "800" },
  subtitle: { fontSize: typography.sm, marginTop: spacing.xs },
  tabBar: {
    flexDirection: "row",
    marginTop: spacing.lg,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    justifyContent: "center",
  },
});
