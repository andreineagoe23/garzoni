import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchProfile,
  getMediaBaseUrl,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { href } from "../../navigation/href";
import { radius, spacing } from "../../theme/tokens";

export function HeaderAvatarButton() {
  const router = useRouter();
  const c = useThemeColors();

  const profileQ = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const profile = profileQ.data as
    | {
        profile_avatar_url?: string | null;
        avatar_url?: string | null;
        profile_avatar?: string | null;
        avatar?: string | null;
        user?: { profile_avatar_url?: string | null } | null;
      }
    | undefined;

  const rawAvatar =
    profile?.profile_avatar_url ||
    profile?.avatar_url ||
    profile?.user?.profile_avatar_url ||
    profile?.profile_avatar ||
    profile?.avatar ||
    "";

  const avatarUri = rawAvatar
    ? /^https?:\/\//i.test(rawAvatar)
      ? rawAvatar
      : `${getMediaBaseUrl()}${rawAvatar.startsWith("/") ? "" : "/"}${rawAvatar}`
    : null;

  return (
    <Pressable
      onPress={() => router.push(href("/(tabs)/profile"))}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      style={styles.button}
    >
      <View
        style={[
          styles.circle,
          { borderColor: c.border, backgroundColor: c.surfaceElevated },
        ]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.image} />
        ) : (
          <Ionicons name="person" size={16} color={c.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

const SIZE = 32;

const styles = StyleSheet.create({
  button: {
    marginLeft: spacing.md,
    padding: 4,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
  },
});
