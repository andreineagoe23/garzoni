import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppleSignInButton } from "./AppleSignInButton";
import { GoogleSignInButton, type SocialAuthSuccessMeta } from "./GoogleSignInButton";
import { isGoogleSignInConfigured } from "../bootstrap/googleOAuthConfig";
import { colors, spacing, typography } from "../theme/tokens";

type Props = {
  onSuccess: (access: string, refresh?: string, meta?: SocialAuthSuccessMeta) => void;
  onError: (message: string) => void;
};

export function AuthSocialSection({ onSuccess, onError }: Props) {
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
    <>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {googleConfigured ? (
        <GoogleSignInButton onSuccess={onSuccess} onError={onError} />
      ) : null}
      {appleAvailable ? <AppleSignInButton onSuccess={onSuccess} onError={onError} /> : null}
      {Platform.OS === "ios" && googleConfigured && !appleAvailable ? (
        <Text style={styles.appleHint}>
          Sign in with Apple is not available in this build (use a dev client with the Sign in with
          Apple capability, signed into iCloud, or continue with Google).
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xxl,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerLabel: {
    marginHorizontal: spacing.md,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  appleHint: {
    marginTop: spacing.md,
    fontSize: typography.xs,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: "center",
  },
});
