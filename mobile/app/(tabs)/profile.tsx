import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchProfile } from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";

export default function ProfileScreen() {
  const { clearSession } = useAuthSession();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetchProfile();
      return res.data;
    },
  });

  const signOut = async () => {
    await clearSession();
    router.replace("/login");
  };

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load profile.</Text>
        <Pressable style={styles.btn} onPress={() => void refetch()}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.outline} onPress={() => void signOut()}>
          <Text style={styles.outlineText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const username = data?.username ?? data?.user?.username ?? "—";
  const email = data?.email ?? data?.user?.email ?? "—";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username</Text>
      <Text style={styles.value}>{username}</Text>
      <Text style={[styles.label, styles.mt]}>Email</Text>
      <Text style={styles.value}>{email}</Text>
      <Pressable style={styles.btn} onPress={() => void signOut()}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 16 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  label: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "600", marginTop: 4 },
  mt: { marginTop: 20 },
  error: { color: "#b91c1c", marginBottom: 12 },
  btn: {
    marginTop: 32,
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  outline: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  outlineText: { fontSize: 16, fontWeight: "600" },
});
