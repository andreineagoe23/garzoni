import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { authLogoWhiteRectangularUrl } from "@garzoni/core";
import { useTheme } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

/** Fetch width for crisp logo on retina. */
const LOGO_FETCH_WIDTH = 560;

/** White rectangular wordmark (`garzoni/logo/garzoni-logo-white-rectangular` on Cloudinary). */
export default function AuthLogoMark() {
  const { resolved, colors } = useTheme();
  const uri = authLogoWhiteRectangularUrl({ width: LOGO_FETCH_WIDTH });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (failed || !uri) {
    return (
      <Text
        style={[
          styles.fallback,
          { color: resolved === "dark" ? colors.text : colors.primary },
        ]}
        accessibilityRole="header"
      >
        Garzoni
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Image
        accessibilityLabel="Garzoni"
        accessibilityRole="image"
        source={{ uri }}
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
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
