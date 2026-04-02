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
import { registerSecure } from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";

export default function RegisterScreen() {
  const { applyTokens } = useAuthSession();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      Alert.alert("Missing fields", "Username, email, and password are required.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await registerSecure({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        client_type: "mobile",
        platform: "mobile",
      });
      if (data?.access) {
        await applyTokens(data.access, data.refresh);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Registration failed", "No access token returned.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const msg =
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Could not register.";
      Alert.alert("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={form.username}
        onChangeText={(v) => update("username", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={(v) => update("email", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={form.password}
        onChangeText={(v) => update("password", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="First name"
        value={form.first_name}
        onChangeText={(v) => update("first_name", v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Last name"
        value={form.last_name}
        onChangeText={(v) => update("last_name", v)}
      />
      <Pressable
        style={[styles.primary, loading && styles.disabled]}
        onPress={() => void onSubmit()}
        disabled={loading}
      >
        <Text style={styles.primaryText}>{loading ? "…" : "Sign up"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
