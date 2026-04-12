import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "react-native";
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

  const profile = profileQ.data;
  const avatarPath = (profile as { avatar?: string | null } | undefined)
    ?.avatar;
  const avatarUri = avatarPath ? `${getMediaBaseUrl()}${avatarPath}` : null;
  const displayName: string =
    (profile as { first_name?: string; username?: string } | undefined)
      ?.first_name ||
    (profile as { username?: string } | undefined)?.username ||
    "?";
  const initials = displayName.charAt(0).toUpperCase();

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
          { borderColor: c.primary, backgroundColor: c.accentMuted },
        ]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.image} />
        ) : (
          <Text style={[styles.initials, { color: c.primary }]}>
            {initials}
          </Text>
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
  initials: {
    fontSize: 13,
    fontWeight: "700",
  },
});
