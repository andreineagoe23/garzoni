import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  fetchFriendSuggestions,
  queryKeys,
  sendFriendRequest,
  type FriendSuggestion,
} from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import GlassCard from "../ui/GlassCard";
import { leaderboardAvatarUri } from "./leaderboardAvatarUri";

export default function LeaderboardSuggestionsCard() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.friendSuggestions(),
    queryFn: () => fetchFriendSuggestions().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const sendMut = useMutation({
    mutationFn: (id: number) => sendFriendRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsSent(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.friendSuggestions(),
      });
    },
  });

  const data = suggestionsQuery.data ?? [];
  if (suggestionsQuery.isPending || data.length === 0) return null;

  return (
    <GlassCard
      padding="md"
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.title, { color: c.text }]}>
        {t("friendSuggestions.title")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.sm }}
      >
        {data.map((s: FriendSuggestion) => {
          const uri = leaderboardAvatarUri(s.profile_avatar ?? null);
          return (
            <View key={s.id} style={styles.item}>
              <Pressable
                onPress={() => router.push(`/friend/${s.id}`)}
                style={{ alignItems: "center" }}
              >
                {uri ? (
                  <Image source={{ uri }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: c.surfaceOffset },
                    ]}
                  />
                )}
                <Text
                  style={[styles.username, { color: c.text }]}
                  numberOfLines={1}
                >
                  {s.username}
                </Text>
                {s.reason === "mutual" && s.mutual_count > 0 ? (
                  <Text style={[styles.meta, { color: c.textMuted }]}>
                    +{s.mutual_count}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => sendMut.mutate(s.id)}
                disabled={sendMut.isPending}
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: c.primary,
                    opacity: sendMut.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.addBtnText, { color: c.textOnPrimary }]}>
                  {t("friendSuggestions.addFriend")}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  title: { fontSize: typography.sm, fontWeight: "800" },
  item: { width: 84, alignItems: "center", gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  username: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
    maxWidth: "100%",
  },
  meta: { fontSize: 10, marginTop: 2 },
  addBtn: {
    marginTop: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  addBtnText: { fontSize: 10, fontWeight: "800" },
});
