import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { authLogoRectangleNoBgUrl } from "@garzoni/core";
import { spacing, typography } from "../../theme/tokens";

const LOGO_URI = authLogoRectangleNoBgUrl({ width: 560 });

export default function AuthLogoMark() {
  const [failed, setFailed] = useState(false);

  if (failed || !LOGO_URI) {
    return (
      <Text style={styles.fallback} accessibilityRole="header">
        Garzoni
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Image
        accessibilityLabel="Garzoni"
        accessibilityRole="image"
        source={{ uri: LOGO_URI }}
        style={styles.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  image: {
    height: 64,
    width: "92%",
    maxWidth: 340,
  },
  fallback: {
    fontSize: typography.xxl,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#fff",
    marginBottom: spacing.sm,
  },
});
