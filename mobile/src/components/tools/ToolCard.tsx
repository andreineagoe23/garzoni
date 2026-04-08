import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";
import type { MobileToolDef } from "./mobileToolsRegistry";

type Props = {
  tool: MobileToolDef;
  onPress: () => void;
  locked?: boolean;
};

export default function ToolCard({ tool, onPress, locked }: Props) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <GlassCard padding="md" style={locked ? { opacity: 0.55 } : undefined}>
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: c.text }]}>{tool.title}</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {tool.subtitle}
            </Text>
            {tool.plusOnly ? (
              <Text style={[styles.badge, { color: c.accent }]}>
                Plus / Pro
              </Text>
            ) : null}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  textCol: { flex: 1 },
  title: { fontSize: typography.md, fontWeight: "700" },
  sub: { fontSize: typography.sm, marginTop: 4 },
  badge: { fontSize: typography.xs, fontWeight: "700", marginTop: spacing.sm },
});
