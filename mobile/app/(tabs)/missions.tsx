import { useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchFinanceFact, fetchMissions, queryKeys } from "@monevo/core";
import MissionCard from "../../src/components/engagement/MissionCard";
import FactCard from "../../src/components/engagement/FactCard";
import { ErrorState, Skeleton } from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

function MissionsInner() {
  const c = useThemeColors();

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const factQuery = useQuery({
    queryKey: ["financeFact"],
    queryFn: () => fetchFinanceFact().then((r) => r.data),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(() => {
    void missionsQuery.refetch();
    void factQuery.refetch();
  }, [missionsQuery, factQuery]);

  const daily = missionsQuery.data?.daily_missions ?? [];
  const weekly = missionsQuery.data?.weekly_missions ?? [];

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={missionsQuery.isFetching}
          onRefresh={onRefresh}
          tintColor={c.primary}
        />
      }
    >
      <Text style={[styles.title, { color: c.text }]}>Missions</Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Complete daily and weekly goals for XP and rewards.
      </Text>

      <View style={{ marginBottom: spacing.lg }}>
        <FactCard
          fact={factQuery.data ?? null}
          loading={factQuery.isPending}
          onRefresh={() => void factQuery.refetch()}
        />
      </View>

      {missionsQuery.isPending ? (
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
      ) : missionsQuery.isError ? (
        <ErrorState message="Could not load missions." onRetry={() => void missionsQuery.refetch()} />
      ) : (
        <>
          <Text style={[styles.section, { color: c.accent }]}>Daily</Text>
          {daily.map((m) => (
            <MissionCard key={`d-${m.id}`} mission={m} />
          ))}
          <Text style={[styles.section, { color: c.accent, marginTop: spacing.lg }]}>
            Weekly
          </Text>
          {weekly.map((m) => (
            <MissionCard key={`w-${m.id}`} mission={m} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

export default function MissionsTab() {
  return (
    <TabErrorBoundary>
      <MissionsInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 80 },
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
  section: { fontSize: typography.md, fontWeight: "800", marginBottom: spacing.md },
});
