import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../theme/ThemeContext";
import { Badge } from "../ui";
import { spacing, typography, radius, shadows } from "../../theme/tokens";

export type LearnCourseRow = {
  id?: number;
  title?: string;
  name?: string;
  short_description?: string;
  completed_lessons?: number;
  total_lessons?: number;
  lesson_count?: number;
  image?: string;
};

type Props = {
  course: LearnCourseRow;
  totalLessons: number;
  onPress: () => void;
};

function courseTitle(c: LearnCourseRow) {
  return c.title ?? c.name ?? `Course ${c.id}`;
}

export default function CourseCard({ course, totalLessons, onPress }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const done = course.completed_lessons ?? 0;
  const pct = totalLessons > 0 ? done / totalLessons : 0;
  const status =
    pct >= 1
      ? t("allTopics.filter.completed")
      : pct > 0
        ? t("allTopics.filter.inProgress")
        : t("allTopics.start");
  const statusColor = pct >= 1 ? c.success : pct > 0 ? c.accent : c.primary;

  return (
    <Pressable
      style={[
        styles.row,
        {
          borderColor: c.border,
          backgroundColor: c.surface,
          ...shadows.sm,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.info}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {courseTitle(course)}
        </Text>
        {totalLessons > 0 ? (
          <Text style={[styles.meta, { color: c.textMuted }]}>
            {t("allTopics.lessonCount", {
              done,
              total: totalLessons,
            })}
          </Text>
        ) : null}
      </View>
      <Badge label={status} color={statusColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  info: { flex: 1, minWidth: 0 },
  title: {
    fontSize: typography.base,
    fontWeight: "600",
  },
  meta: {
    fontSize: typography.xs,
    marginTop: 2,
  },
});
