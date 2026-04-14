import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppleSignInButton } from "./AppleSignInButton";
import {
  GoogleSignInButton,
  type SocialAuthSuccessMeta,
} from "./GoogleSignInButton";
import { isGoogleSignInConfigured } from "../bootstrap/googleOAuthConfig";
import { spacing, typography } from "../theme/tokens";
import { useThemeColors } from "../theme/ThemeContext";

type Props = {
  onSuccess: (
    access: string,
    refresh?: string,
    meta?: SocialAuthSuccessMeta,
  ) => void;
  onError: (message: string) => void;
};

export function AuthSocialSection({ onSuccess, onError }: Props) {
  const c = useThemeColors();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const googleConfigured = isGoogleSignInConfigured();

  if (!googleConfigured && !appleAvailable) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {googleConfigured ? (
        <GoogleSignInButton onSuccess={onSuccess} onError={onError} />
      ) : null}
      {appleAvailable ? (
        <AppleSignInButton onSuccess={onSuccess} onError={onError} />
      ) : null}
      {Platform.OS === "ios" && googleConfigured && !appleAvailable ? (
        <Text style={[styles.appleHint, { color: c.textMuted }]}>
          Sign in with Apple is not available in this build (use a dev client
          with the Sign in with Apple capability, signed into iCloud, or
          continue with Google).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Slightly more space between native controls (matches common auth stacks). */
  stack: { width: "100%", gap: spacing.md },
  appleHint: {
    marginTop: spacing.md,
    fontSize: typography.xs,
    lineHeight: 18,
    textAlign: "center",
  },
});
