import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getBackendUrl, googleVerifyCredential } from "@garzoni/core";
import {
  getGoogleIosClientId,
  getGoogleWebClientId,
} from "../bootstrap/googleOAuthConfig";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, typography } from "../theme/tokens";

export type SocialAuthSuccessMeta = { next?: string };

type Props = {
  onSuccess: (
    access: string,
    refresh?: string,
    meta?: SocialAuthSuccessMeta,
  ) => void;
  onError: (message: string) => void;
};

let configured = false;
let lastWeb = "";
let lastIos = "";

function ensureConfigured(): boolean {
  const webClientId = getGoogleWebClientId();
  const iosClientId = getGoogleIosClientId();
  if (!webClientId && !iosClientId) return false;
  if (configured && webClientId === lastWeb && iosClientId === lastIos) {
    return true;
  }
  GoogleSignin.configure({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
  });
  configured = true;
  lastWeb = webClientId;
  lastIos = iosClientId;
  return true;
}

/** Official multicolor G (same paths as web `Login.tsx`). */
function GoogleMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

/**
 * Current “Sign in with Google” neutral button (full width, light/dark shells) — same pattern as
 * web, while still using `GoogleSignin.signIn()` for native auth (avoids legacy `GoogleSigninButton` art).
 */
export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const { t } = useTranslation("common");
  const { resolved, colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const webClientId = getGoogleWebClientId();
  const iosClientId = getGoogleIosClientId();
  if (!webClientId && !iosClientId) {
    return null;
  }

  const isDark = resolved === "dark";
  const shell = isDark
    ? {
        backgroundColor: "#131314",
        borderColor: "#8e918f",
        textColor: "#e3e3e3",
      }
    : {
        backgroundColor: "#ffffff",
        borderColor: colors.border,
        textColor: "#1f1f1f",
      };

  const handlePress = async () => {
    if (!ensureConfigured()) return;
    setBusy(true);
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }
      const res = await GoogleSignin.signIn();
      if (res.type !== "success") {
        return;
      }
      let idToken = res.data.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      if (!idToken) {
        onError(
          "Google did not return an ID token. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Android) / iOS client id.",
        );
        return;
      }
      const { data } = await googleVerifyCredential({
        credential: idToken,
        state: "all-topics",
      });
      if (data?.access) {
        onSuccess(data.access, data.refresh, { next: data.next });
      } else {
        onError("Invalid response from server.");
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      const msg = err.message ?? "";
      if (
        /network|fetch|failed to connect|could not connect/i.test(msg) ||
        (!msg && String(e) === "Network Error")
      ) {
        onError(
          `Cannot reach API (${getBackendUrl()}). Set EXPO_PUBLIC_BACKEND_URL to your Railway URL and restart Expo.`,
        );
        return;
      }
      onError(msg || "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("auth.signInWithGoogle")}
      disabled={busy}
      onPress={() => void handlePress()}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: shell.backgroundColor,
          borderColor: shell.borderColor,
          opacity: busy ? 0.72 : pressed ? 0.92 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={shell.textColor} />
      ) : (
        <View style={styles.row}>
          <GoogleMark />
          <Text style={[styles.label, { color: shell.textColor }]}>
            {t("auth.signInWithGoogle")}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: "100%",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
});
