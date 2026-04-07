import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ThemeColors } from "../../theme/palettes";
import { spacing, typography, radius } from "../../theme/tokens";

export type ActivityDaySummary = {
  date: string;
  totalActivities: number;
  lessonsCompleted: number;
  sectionsCompleted: number;
  exercisesCompleted: number;
};

export type ActivityCalendarMap = Record<string, ActivityDaySummary>;

type Props = {
  activityMap: ActivityCalendarMap;
  /** First day of the month (e.g. "2026-04-01") */
  firstDay: string;
  /** Last day to show — typically today, never past last day of month */
  lastDay: string;
  colors: ThemeColors;
  onDaySelected?: (summary: ActivityDaySummary | null) => void;
  selectedDate?: string | null;
};

const COLS = 7;
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** 5-level intensity: transparent border for 0, progressively opaque primary for activity */
function cellBg(count: number, primary: string, surfaceOffset: string): string {
  if (count === 0) return surfaceOffset;
  if (count <= 2) return primary + "35";
  if (count <= 5) return primary + "65";
  if (count <= 9) return primary + "95";
  return primary;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function DashboardActivityHeatmap({
  activityMap,
  firstDay,
  lastDay,
  colors,
  onDaySelected,
  selectedDate,
}: Props) {
  const [y, m] = firstDay.split("-");
  const firstDate = new Date(firstDay);
  const lastDate = new Date(lastDay);

  // Total days to render (from 1st of month to lastDay)
  const daysToShow = lastDate.getDate(); // day-of-month of lastDay
  const firstDayOfWeek = firstDate.getDay(); // 0=Sun

  // Build cells: null placeholders + day numbers 1..daysToShow
  const placeholders: null[] = Array.from({ length: firstDayOfWeek }, () => null);
  const days: number[] = Array.from({ length: daysToShow }, (_, i) => i + 1);
  const cells: (number | null)[] = [...placeholders, ...days];

  // Split into rows of 7
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += COLS) {
    rows.push(cells.slice(i, i + COLS));
  }

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const selectedSummary = selectedDate ? (activityMap[selectedDate] ?? null) : null;

  return (
    <View>
      {/* Weekday header */}
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <View key={i} style={styles.cellSlot}>
            <Text style={[styles.weekday, { color: colors.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((day, di) => {
            if (day === null) {
              return (
                <View
                  key={`p-${ri}-${di}`}
                  style={[styles.cellSlot, styles.cellSlotEmpty]}
                />
              );
            }

            const dateStr = `${y}-${m}-${String(day).padStart(2, "0")}`;
            const isFuture = dateStr > todayStr;
            const summary = activityMap[dateStr];
            const count = isFuture ? 0 : (summary?.totalActivities ?? 0);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const bg = isFuture ? colors.surfaceOffset + "60" : cellBg(count, colors.primary, colors.surfaceOffset);

            return (
              <TouchableOpacity
                key={day}
                style={styles.cellSlot}
                onPress={() => !isFuture && onDaySelected?.(summary ?? null)}
                activeOpacity={isFuture ? 1 : 0.7}
                disabled={isFuture}
              >
                <View
                  style={[
                    styles.cell,
                    {
                      backgroundColor: bg,
                      borderColor: isSelected
                        ? colors.accent
                        : isToday
                        ? colors.primary
                        : colors.border,
                      borderWidth: isSelected || isToday ? 1.5 : StyleSheet.hairlineWidth,
                      opacity: isFuture ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color: count > 5
                          ? colors.surface
                          : isToday
                          ? colors.primary
                          : colors.text,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                  {count > 0 && !isFuture ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: count > 5 ? colors.surface : colors.accent },
                      ]}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Detail card */}
      {selectedDate ? (
        <View style={[styles.detail, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.detailDate, { color: colors.text }]}>
            {formatDisplayDate(selectedDate)}
          </Text>
          {selectedSummary && selectedSummary.totalActivities > 0 ? (
            <View style={styles.statsRow}>
              <Stat label="Lessons" value={selectedSummary.lessonsCompleted} color={colors.primary} />
              <Stat label="Sections" value={selectedSummary.sectionsCompleted} color={colors.primary} />
              <Stat label="Exercises" value={selectedSummary.exercisesCompleted} color={colors.accent} />
            </View>
          ) : (
            <Text style={[styles.noActivity, { color: colors.textMuted }]}>No activity this day</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: "#888" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: "row", width: "100%" },
  cellSlot: {
    flex: 1,
    minWidth: 0,
    padding: 2,
    alignItems: "center",
  },
  cellSlotEmpty: {
    minHeight: 44,
  },
  weekday: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  cell: {
    width: "100%",
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayNum: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  detail: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  detailDate: {
    fontSize: typography.sm,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: 4,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: typography.lg, fontWeight: "800" },
  statLabel: { fontSize: typography.xs, marginTop: 2 },
  noActivity: { fontSize: typography.sm },
});
