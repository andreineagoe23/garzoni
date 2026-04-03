import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppleSignInButton } from "./AppleSignInButton";
import { GoogleSignInButton, type SocialAuthSuccessMeta } from "./GoogleSignInButton";
import { colors, spacing, typography } from "../theme/tokens";

const googleConfigured = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
);

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
});
