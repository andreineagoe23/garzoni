import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchProgressSummary } from "@monevo/core";

export default function DashboardScreen() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["progressSummary"],
    queryFn: async () => {
      const res = await fetchProgressSummary();
      return res.data;
    },
  });

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
        <Text style={styles.error}>
          {(error as Error)?.message ?? "Failed to load progress"}
        </Text>
        <Pressable style={styles.btn} onPress={() => void refetch()}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const rawOverall = Number(data?.overall_progress ?? 0);
  const overallLabel =
    rawOverall <= 1
      ? `${Math.round(rawOverall * 100)}%`
      : `${Math.round(rawOverall)}%`;
  const lessonsDone = data?.completed_lessons ?? 0;
  const lessonsTotal = data?.total_lessons ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your progress</Text>
      <View style={styles.card}>
        <Text style={styles.metric}>{overallLabel}</Text>
        <Text style={styles.label}>Overall</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.metric}>
          {lessonsDone} / {lessonsTotal}
        </Text>
        <Text style={styles.label}>Lessons completed</Text>
      </View>
      <Pressable
        style={styles.secondary}
        onPress={() => router.push("/learn")}
      >
        <Text style={styles.secondaryText}>Browse learning paths</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  metric: { fontSize: 28, fontWeight: "700" },
  label: { color: "#666", marginTop: 4 },
  error: { color: "#b91c1c", textAlign: "center", marginBottom: 12 },
  btn: {
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  secondary: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  secondaryText: { fontSize: 16, fontWeight: "600" },
});
