import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import { ImpactBadge } from "./ImpactBadge";
import type { CalendarEvent } from "../../../types/economic-calendar";

type Props = { event: CalendarEvent };

export function EventCard({ event }: Props) {
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.nameGroup}>
          {event.currency && (
            <Text style={[styles.currency, { color: c.textFaint }]}>
              {event.currency}
            </Text>
          )}
          <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
            {event.name}
          </Text>
          {event.time && (
            <Text style={[styles.time, { color: c.textFaint }]}>
              {event.time}
            </Text>
          )}
        </View>
        <ImpactBadge impact={event.impact} />
      </View>

      {(event.forecast != null || event.actual != null) && (
        <View style={[styles.dataRow, { borderTopColor: c.border }]}>
          {event.forecast != null && (
            <DataItem
              label="Forecast"
              value={event.forecast}
              color={c.textMuted}
            />
          )}
          {event.actual != null && (
            <DataItem
              label="Actual"
              value={event.actual}
              color={c.text}
              highlight
            />
          )}
        </View>
      )}
    </View>
  );
}

function DataItem({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.dataItem}>
      <Text style={[styles.dataLabel, { color }]}>{label}</Text>
      <Text
        style={[
          styles.dataValue,
          { color, fontWeight: highlight ? "700" : "400" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.md,
    gap: spacing.md,
  },
  nameGroup: { flex: 1, gap: 2 },
  currency: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  name: { fontSize: typography.sm, fontWeight: "600", lineHeight: 18 },
  time: { fontSize: typography.xs },
  dataRow: {
    flexDirection: "row",
    gap: spacing.lg,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dataItem: { gap: 2 },
  dataLabel: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dataValue: { fontSize: typography.sm },
});
