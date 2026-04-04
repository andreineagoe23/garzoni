import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "../../theme/palettes";
import { spacing, typography, radius } from "../../theme/tokens";

type CurrentMonth = {
  first_day?: string | number | Date | null;
  last_day?: string | number | Date | null;
  month_name?: string;
  year?: number | string | null;
};

type Props = {
  currentMonth: CurrentMonth;
  activityCalendar: Record<string, unknown>;
  weekdayLabels: string[];
  colors: ThemeColors;
};

const COLS = 7;

export default function ActivityCalendarMobile({
  currentMonth,
  activityCalendar,
  weekdayLabels,
  colors,
}: Props) {
  if (!currentMonth.first_day || !currentMonth.last_day) return null;

  const firstDay = new Date(currentMonth.first_day as string | number | Date);
  const lastDay = new Date(currentMonth.last_day as string | number | Date);
  const daysInMonth = lastDay.getDate();
  const firstDayOfWeek = firstDay.getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const placeholders = Array.from({ length: firstDayOfWeek }, () => null as number | null);
  const cells: (number | null)[] = [...placeholders, ...days];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += COLS) {
    rows.push(cells.slice(i, i + COLS));
  }

  const firstDayStr = String(currentMonth.first_day ?? "");
  const [y, m] = firstDayStr.split("-");

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Text style={[styles.monthTitle, { color: colors.text }]}>
        {currentMonth.month_name} {currentMonth.year}
      </Text>
      <View style={styles.weekRow}>
        {weekdayLabels.map((label) => (
          <View key={label} style={styles.cellSlot}>
            <Text style={[styles.weekday, { color: colors.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={`r-${ri}`} style={styles.weekRow}>
          {row.map((day, di) => {
            if (day === null) {
              return (
                <View
                  key={`p-${ri}-${di}`}
                  style={[
                    styles.cellSlot,
                    styles.cellEmpty,
                    { borderColor: colors.border },
                  ]}
                />
              );
            }
            const dateStr = `${y}-${m}-${String(day).padStart(2, "0")}`;
            const activityCount = (activityCalendar[dateStr] as number) ?? 0;
            const hasActivity = activityCount > 0;
            return (
              <View key={day} style={styles.cellSlot}>
                <View
                  style={[
                    styles.cell,
                    {
                      borderColor: colors.border,
                      backgroundColor: hasActivity ? colors.primary + "18" : colors.surfaceOffset,
                    },
                  ]}
                >
                  <Text style={[styles.dayNum, { color: colors.text }]}>{day}</Text>
                  {hasActivity ? (
                    <Text style={[styles.count, { color: colors.accent }]}>{activityCount}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  monthTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  weekRow: { flexDirection: "row", width: "100%" },
  cellSlot: {
    flex: 1,
    minWidth: 0,
    padding: 2,
    alignItems: "center",
  },
  weekday: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  cellEmpty: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderRadius: radius.sm,
    marginVertical: 2,
    width: "100%",
  },
  cell: {
    width: "100%",
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayNum: { fontSize: typography.xs, fontWeight: "700" },
  count: { fontSize: 9, fontWeight: "700", marginTop: 2 },
});
