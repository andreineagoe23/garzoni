import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { googleVerifyCredential } from "@monevo/core";

type Props = {
  onSuccess: (access: string, refresh?: string) => void;
  onError: (message: string) => void;
};

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

let configured = false;

function ensureConfigured() {
  if (configured) return Boolean(webClientId || iosClientId);
  if (!webClientId && !iosClientId) return false;
  GoogleSignin.configure({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
  });
  configured = true;
  return true;
}

export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const [busy, setBusy] = useState(false);

  if (!webClientId && !iosClientId) {
    return null;
  }

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
        onError("Google did not return an ID token. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (Android) / iOS client id.");
        return;
      }
      const { data } = await googleVerifyCredential({
        credential: idToken,
        state: "all-topics",
      });
      if (data?.access) {
        onSuccess(data.access, data.refresh);
      } else {
        onError("Invalid response from server.");
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      onError(err.message ?? "Google sign-in failed.");
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
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.btnText}>Continue with Google</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, width: "100%" },
  btn: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: "600", color: "#111" },
});
