import { useMemo } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLearningPaths,
  getMediaBaseUrl,
  Images,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";

type PathRow = {
  id: number;
  title: string;
  description?: string;
  image?: string;
  courses?: { id: number; title?: string }[];
};

function coverForPath(p: PathRow): string {
  if (p.image) {
    return p.image.startsWith("http")
      ? p.image
      : `${getMediaBaseUrl()}/media/${String(p.image).replace(/^\/+/, "")}`;
  }
  const t = p.title.toLowerCase();
  if (t.includes("crypto")) return Images.crypto;
  if (t.includes("forex") || t.includes("fx")) return Images.forex;
  if (t.includes("mindset")) return Images.mindset;
  if (t.includes("real estate") || t.includes("property")) return Images.realEstate;
  if (t.includes("personal")) return Images.personalFinance;
  return Images.basicFinance;
}

export default function AllTopicsGrid() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const colW = (width - spacing.xl * 2 - spacing.md) / 2;

  const q = useQuery({
    queryKey: queryKeys.learningPaths(),
    queryFn: () => fetchLearningPaths().then((r) => r.data as PathRow[]),
    staleTime: staleTimes.content,
  });

  const paths = useMemo(() => q.data ?? [], [q.data]);

  if (q.isPending) {
    return (
      <View>
        <Text style={[styles.heading, { color: c.accent }]}>All topics</Text>
        <Text style={{ color: c.textMuted }}>Loading paths…</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.heading, { color: c.accent }]}>All topics</Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Choose a path to see courses.
      </Text>
      <View style={[styles.grid, { marginTop: spacing.md }]}>
        {paths.map((p) => {
          const firstCourse = p.courses?.[0];
          const uri = coverForPath(p);
          return (
            <Pressable
              key={p.id}
              style={{ width: colW }}
              onPress={() => {
                if (firstCourse?.id) {
                  router.push(`/course/${firstCourse.id}`);
                } else {
                  router.push("/(tabs)/learn");
                }
              }}
            >
              <GlassCard padding="none" style={styles.card}>
                <Image source={{ uri }} style={styles.img} />
                <View style={{ padding: spacing.md }}>
                  <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
                    {p.title}
                  </Text>
                  {p.description ? (
                    <Text
                      style={[styles.cardDesc, { color: c.textMuted }]}
                      numberOfLines={2}
                    >
                      {p.description}
                    </Text>
                  ) : null}
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: typography.md, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { overflow: "hidden" },
  img: { width: "100%", height: 96, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  cardTitle: { fontSize: typography.sm, fontWeight: "700" },
  cardDesc: { fontSize: typography.xs, marginTop: 4, lineHeight: 16 },
});
