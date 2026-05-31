import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { queryKeys, searchUsers, type UserSearchResult } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";
import { leaderboardAvatarUri } from "./leaderboardAvatarUri";

type Props = { query: string };

export default function LeaderboardSearchResults({ query }: Props) {
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const trimmed = query.trim();

  const searchQuery = useQuery({
    queryKey: queryKeys.userSearch(trimmed),
    queryFn: () => searchUsers(trimmed).then((r) => r.data),
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });

  if (trimmed.length === 0) return null;
  if (trimmed.length < 2) {
    return (
      <Text style={[styles.note, { color: c.textMuted }]}>
        {t("userSearch.minChars")}
      </Text>
    );
  }

  const data = searchQuery.data ?? [];
  if (searchQuery.isPending) return null;

  if (data.length === 0) {
    return (
      <Text style={[styles.note, { color: c.textMuted }]}>
        {t("userSearch.empty", { query: trimmed })}
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
      {data.map((u: UserSearchResult) => {
        const uri = leaderboardAvatarUri(u.profile_avatar ?? null);
        return (
          <Pressable key={u.id} onPress={() => router.push(`/friend/${u.id}`)}>
            <GlassCard
              padding="md"
              style={[
                styles.row,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.avatar} />
              ) : (
                <View
                  style={[styles.avatar, { backgroundColor: c.surfaceOffset }]}
                />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.username, { color: c.text }]}
                  numberOfLines={1}
                >
                  {u.username}
                </Text>
                <Text style={[styles.points, { color: c.textMuted }]}>
                  {u.points.toLocaleString(i18n.language)} XP
                </Text>
              </View>
              <Text style={[styles.chevron, { color: c.textFaint }]}>›</Text>
            </GlassCard>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  username: { fontSize: typography.base, fontWeight: "700" },
  points: { fontSize: typography.xs, marginTop: 2 },
  chevron: { fontSize: 20, fontWeight: "300" },
  note: {
    fontSize: typography.sm,
    textAlign: "center",
    marginVertical: spacing.md,
  },
});
