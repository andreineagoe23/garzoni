import { useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  /** Total seconds for the drill */
  totalSeconds: number;
  /** Fires once when timer hits 0 */
  onExpire?: () => void;
  active?: boolean;
};

function formatMmSs(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Countdown for timed drills. Pauses while app is backgrounded.
 */
export default function ExerciseTimer({
  totalSeconds,
  onExpire,
  active = true,
}: Props) {
  const c = useThemeColors();
  const [left, setLeft] = useState(totalSeconds);
  const expiredRef = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    setLeft(totalSeconds);
    expiredRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (!active || totalSeconds <= 0) return;

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      appState.current = next;
    });

    const id = setInterval(() => {
      if (appState.current !== "active") return;
      setLeft((prev) => {
        if (prev <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active, totalSeconds, onExpire]);

  if (totalSeconds <= 0) return null;

  const urgent = left <= 10 && left > 0;

  return (
    <View
      style={[
        styles.bar,
        {
          borderColor: urgent ? c.error : c.border,
          backgroundColor: c.surface,
        },
      ]}
    >
      <Text style={[styles.label, { color: c.textMuted }]}>Time</Text>
      <Text style={[styles.time, { color: urgent ? c.error : c.text }]}>
        {formatMmSs(left)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  label: { fontSize: typography.sm, fontWeight: "700" },
  time: {
    fontSize: typography.lg,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
