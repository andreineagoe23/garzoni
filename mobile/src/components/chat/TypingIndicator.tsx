import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { typography } from "../../theme/tokens";

type Props = {
  label: string;
};

/** Animated “thinking” dots after the label (chat assistant in-flight). */
export default function TypingIndicator({ label }: Props) {
  const c = useThemeColors();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);

  const dots = useMemo(() => ".".repeat(tick === 0 ? 0 : tick), [tick]);

  return (
    <View style={styles.row}>
      <Text style={[styles.text, { color: c.textMuted }]}>
        {label}
        {dots}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 2, paddingHorizontal: 4 },
  text: { fontSize: typography.sm, fontStyle: "italic" },
});
