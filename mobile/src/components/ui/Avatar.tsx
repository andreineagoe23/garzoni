import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, typography } from "../../theme/tokens";

type AvatarProps = {
  username?: string;
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

export default function Avatar({ username, size = 48, style }: AvatarProps) {
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
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
