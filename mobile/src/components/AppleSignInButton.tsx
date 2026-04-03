import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { appleVerifyIdentity, getBackendUrl } from "@monevo/core";
import type { SocialAuthSuccessMeta } from "./GoogleSignInButton";

type Props = {
  onSuccess: (access: string, refresh?: string, meta?: SocialAuthSuccessMeta) => void;
  onError: (message: string) => void;
};

export function AppleSignInButton({ onSuccess, onError }: Props) {
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== "ios") {
    return null;
  }

  const handlePress = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
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
          `Cannot reach API (${getBackendUrl()}). Set EXPO_PUBLIC_BACKEND_URL and restart Expo.`
        );
        return;
      }
      onError(msg || "Apple sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void handlePress()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Continue with Apple</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, width: "100%" },
  btn: {
    backgroundColor: "#000",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
