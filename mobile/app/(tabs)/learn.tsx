import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  courseService,
  fetchLessonsWithProgress,
  pathService,
} from "@monevo/core";

type PathRow = { id?: number; title?: string; name?: string };
type CourseRow = { id?: number; title?: string; name?: string };

export default function LearnScreen() {
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);

  const pathsQuery = useQuery({
    queryKey: ["paths"],
    queryFn: async () => {
      const res = await pathService.fetchPaths();
      return res.data as PathRow[];
    },
  });

  const coursesQuery = useQuery({
    queryKey: ["courses", selectedPathId],
    enabled: selectedPathId != null,
    queryFn: async () => {
      const res = await courseService.fetchForPath(selectedPathId!);
      return res.data as CourseRow[];
    },
  });

  const openFirstLesson = async (courseId: number) => {
    try {
      const res = await fetchLessonsWithProgress(courseId);
      const list = res.data as { id?: number }[];
      const first = list?.[0];
      if (first?.id != null) {
        router.push(`/lesson/${first.id}`);
      }
    } catch {
      /* handled by query UI elsewhere */
    }
  };

  if (pathsQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (pathsQuery.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load paths.</Text>
      </View>
    );
  }

  const rawPaths = pathsQuery.data;
  const paths = Array.isArray(rawPaths)
    ? rawPaths
    : Array.isArray((rawPaths as { results?: PathRow[] })?.results)
      ? (rawPaths as { results: PathRow[] }).results
      : [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Learning paths</Text>
      <FlatList
        data={paths}
        keyExtractor={(item, i) => String(item.id ?? i)}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.row,
              selectedPathId === item.id && styles.rowSelected,
            ]}
            onPress={() => setSelectedPathId(item.id ?? null)}
          >
            <Text style={styles.rowText}>
              {item.title ?? item.name ?? `Path ${item.id}`}
            </Text>
          </Pressable>
        )}
      />
      {selectedPathId != null && (
        <View style={styles.courses}>
          <Text style={styles.subheading}>Courses</Text>
          {coursesQuery.isPending ? (
            <ActivityIndicator />
          ) : coursesQuery.isError ? (
            <Text style={styles.error}>Failed to load courses.</Text>
          ) : (
            <FlatList
              data={(() => {
                const d = coursesQuery.data;
                if (Array.isArray(d)) return d;
                const r = (d as { results?: CourseRow[] })?.results;
                return Array.isArray(r) ? r : [];
              })()}
              keyExtractor={(item, i) => String(item.id ?? i)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    if (item.id != null) void openFirstLesson(item.id);
                  }}
                >
                  <Text style={styles.rowText}>
                    {item.title ?? item.name ?? `Course ${item.id}`}
                  </Text>
                  <Text style={styles.hint}>Open first lesson</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  subheading: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  rowSelected: { backgroundColor: "#eef2ff" },
  rowText: { fontSize: 16 },
  hint: { fontSize: 12, color: "#666", marginTop: 4 },
  courses: { flex: 1, borderTopWidth: 1, borderColor: "#eee", paddingTop: 8 },
  error: { color: "#b91c1c" },
});
