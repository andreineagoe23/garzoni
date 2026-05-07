import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import LoadingSpinner from "./ui/LoadingSpinner";
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  AppleAuthenticationScope,
  signInAsync,
} from "expo-apple-authentication";
import { appleVerifyIdentity, getBackendUrl } from "@garzoni/core";
import type { SocialAuthSuccessMeta } from "./GoogleSignInButton";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  onSuccess: (
    access: string,
    refresh?: string,
    meta?: SocialAuthSuccessMeta,
  ) => void;
  onError: (message: string) => void;
};

const BUTTON_HEIGHT = 50;
const CORNER_RADIUS = 12;

/**
 * System Sign in with Apple — white filled control on dark UI, black on light (matches Apple HIG
 * on grey surfaces and flips with in-app theme).
 */
export function AppleSignInButton({ onSuccess, onError }: Props) {
  const { resolved } = useTheme();
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== "ios") {
    return null;
  }

  const useDarkAppearance = resolved === "dark";
  const buttonStyle = useDarkAppearance
    ? AppleAuthenticationButtonStyle.WHITE
    : AppleAuthenticationButtonStyle.BLACK;

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const credential = await signInAsync({
        requestedScopes: [
          AppleAuthenticationScope.FULL_NAME,
          AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = credential.identityToken;
      if (!identityToken) {
        onError("Apple did not return an identity token.");
        return;
      }
      const gn = credential.fullName?.givenName ?? "";
      const fn = credential.fullName?.familyName ?? "";
      const { data } = await appleVerifyIdentity({
        identity_token: identityToken,
        state: "all-topics",
        first_name: gn.trim() || undefined,
        last_name: fn.trim() || undefined,
      });
      if (data?.access) {
        onSuccess(data.access, data.refresh, { next: data.next });
      } else {
        onError("Invalid response from server.");
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "ERR_REQUEST_CANCELED" || err.code === "ERR_CANCELED") {
        return;
      }
      const msg = err.message ?? "";
      if (/network|fetch|failed to connect|could not connect/i.test(msg)) {
        onError(
          `Cannot reach API (${getBackendUrl()}). Set EXPO_PUBLIC_BACKEND_URL and restart Expo.`,
        );
        return;
      }
      onError(msg || "Apple sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.outer}>
      <View style={[styles.slot, busy && styles.slotBusy]}>
        <AppleAuthenticationButton
          buttonType={AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={buttonStyle}
          cornerRadius={CORNER_RADIUS}
          style={styles.appleNative}
          onPress={() => void handlePress()}
        />
        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="auto">
            <LoadingSpinner
              size="sm"
              color={useDarkAppearance ? "#000" : "#fff"}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    alignItems: "stretch",
  },
  slot: {
    position: "relative",
    minHeight: BUTTON_HEIGHT,
    width: "100%",
  },
  slotBusy: { opacity: 0.88 },
  appleNative: {
    width: "100%",
    height: BUTTON_HEIGHT,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: CORNER_RADIUS,
  },
});
