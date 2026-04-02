import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { lessonService } from "@monevo/core";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = id ?? "";

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["lesson", lessonId],
    enabled: Boolean(lessonId),
    queryFn: async () => {
      const res = await lessonService.fetchById(lessonId);
      return res.data as Record<string, unknown>;
    },
  });

  if (!lessonId) {
    return (
      <View style={styles.centered}>
        <Text>Missing lesson id.</Text>
      </View>
    );
  }

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
          {(error as Error)?.message ?? "Failed to load lesson"}
        </Text>
      </View>
    );
  }

  const title =
    (typeof data?.title === "string" && data.title) ||
    (typeof data?.name === "string" && data.name) ||
    `Lesson ${lessonId}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>ID: {lessonId}</Text>
      <Text style={styles.note}>
        Full lesson UI (sections, quizzes) can be built here using the same
        payloads as the web app.
      </Text>
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
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  meta: { color: "#666", marginBottom: 16 },
  note: { fontSize: 14, lineHeight: 20, color: "#444" },
  error: { color: "#b91c1c", textAlign: "center" },
});
