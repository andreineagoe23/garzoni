import { Ionicons } from "@expo/vector-icons";
import {
  fetchIncomingFriendRequests,
  queryKeys,
  respondToFriendRequest,
  type FriendRequestIncoming,
} from "@garzoni/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

export default function LeaderboardFriendRequestsCard() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const requestsQuery = useQuery({
    queryKey: queryKeys.friendRequestsIncoming(),
    queryFn: () => fetchIncomingFriendRequests().then((r) => r.data),
    staleTime: 60_000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "reject" }) =>
      respondToFriendRequest(id, action),
    onSuccess: (_, { action }) => {
      setMessage(
        action === "accept"
          ? t("profile.friendRequests.accepted")
          : t("profile.friendRequests.declined"),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsIncoming(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendsList() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboardFriends(),
      });
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: string; detail?: string } };
      };
      setMessage(
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          t("profile.friendRequests.error"),
      );
    },
  });

  const onRespond = useCallback(
    (id: number, action: "accept" | "reject") => {
      respondMutation.mutate({ id, action });
    },
    [respondMutation],
  );

  const requests = requestsQuery.data ?? [];
  const loading = requestsQuery.isPending;

  return (
    <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("profile.friendRequests.title")}
          </Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            {t("profile.friendRequests.subtitle")}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${c.primary}22` }]}>
          <Text style={[styles.badgeText, { color: c.accent }]}>
            {requests.length}
          </Text>
        </View>
      </View>

      {message ? (
        <View
          style={[
            styles.msg,
            { borderColor: `${c.accent}44`, backgroundColor: `${c.accent}14` },
          ]}
        >
          <Text style={{ color: c.accent, fontSize: typography.sm }}>
            {message}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : requestsQuery.isError ? (
          <Text style={{ color: c.error, fontSize: typography.sm }}>
            {t("profile.friendRequests.loadFailed")}
          </Text>
        ) : requests.length === 0 ? (
          <View
            style={[
              styles.empty,
              { borderColor: c.border, backgroundColor: c.surfaceOffset },
            ]}
          >
            <Ionicons name="mail-outline" size={40} color={c.textMuted} />
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {t("profile.friendRequests.empty")}
            </Text>
          </View>
        ) : (
          requests.map((request: FriendRequestIncoming) => (
            <View
              key={request.id}
              style={[
                styles.reqRow,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <View style={styles.reqLeft}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: `${c.primary}18` },
                  ]}
                >
                  <Ionicons name="person" size={20} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reqName, { color: c.text }]}>
                    {request.sender.username}
                  </Text>
                  <Text style={[styles.reqHint, { color: c.textMuted }]}>
                    {t("profile.friendRequests.wantsToConnect")}
                  </Text>
                </View>
              </View>
              <View style={styles.reqActions}>
                <Pressable
                  onPress={() => onRespond(request.id, "accept")}
                  disabled={respondMutation.isPending}
                  style={({ pressed }) => [
                    styles.acceptBtn,
                    { opacity: pressed ? 0.9 : 1, backgroundColor: c.primary },
                  ]}
                >
                  <Text style={[styles.btnText, { color: c.textOnPrimary }]}>
                    {t("profile.friendRequests.accept")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onRespond(request.id, "reject")}
                  disabled={respondMutation.isPending}
                  style={({ pressed }) => [
                    styles.declineBtn,
                    {
                      opacity: pressed ? 0.9 : 1,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: c.textMuted }]}>
                    {t("profile.friendRequests.decline")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  title: { fontSize: typography.md, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4, lineHeight: 20 },
  badge: {
    minWidth: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: typography.sm, fontWeight: "800" },
  msg: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
  },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    gap: spacing.md,
  },
  emptyText: { fontSize: typography.sm, textAlign: "center" },
  reqRow: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  reqLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  reqName: { fontSize: typography.sm, fontWeight: "700" },
  reqHint: { fontSize: typography.xs, marginTop: 2 },
  reqActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  acceptBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
  },
  declineBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: typography.sm, fontWeight: "700" },
});
