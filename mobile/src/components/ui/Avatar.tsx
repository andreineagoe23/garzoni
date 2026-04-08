import React from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, typography } from "../../theme/tokens";

type AvatarProps = {
  username?: string;
  /** Full URL for profile image; when set, shown instead of initials. */
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({
  username,
  uri,
  size = 48,
  style,
}: AvatarProps) {
  const fontSize = size * 0.38;
  const r = size / 2;

  if (uri) {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: r, overflow: "hidden" },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: r },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials(username)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.white,
    fontWeight: "700",
  },
});
