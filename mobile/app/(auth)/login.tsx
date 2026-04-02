import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { loginSecure } from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { GoogleSignInButton } from "../../src/components/GoogleSignInButton";

export default function LoginScreen() {
  const { applyTokens } = useAuthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing fields", "Enter username and password.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginSecure({
        username: username.trim(),
        password,
      });
      if (data?.access) {
        await applyTokens(data.access, data.refresh);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Login failed", "No access token returned.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const msg =
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Could not sign in. Check API URL and credentials.";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={[styles.primary, loading && styles.disabled]}
        onPress={() => void onSubmit()}
        disabled={loading}
      >
        <Text style={styles.primaryText}>{loading ? "…" : "Sign in"}</Text>
      </Pressable>
      <GoogleSignInButton
        onSuccess={async (access, refresh) => {
          await applyTokens(access, refresh);
          router.replace("/(tabs)");
        }}
        onError={(m) => Alert.alert("Google sign-in", m)}
      />
      <Link href="/register" style={styles.link}>
        <Text style={styles.linkText}>Create an account</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: "#fff",
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  primary: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  link: { marginTop: 24, alignSelf: "center" },
  linkText: { color: "#2563eb", fontSize: 16 },
});
