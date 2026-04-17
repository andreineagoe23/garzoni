import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import HapticPressable from "../ui/HapticPressable";
import { spacing, typography, radius } from "../../theme/tokens";

const CARD_WIDTH = 158;

type TileProps = {
  children: ReactNode;
  urgent?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  /**
   * `strip` = fixed width for horizontal KPI scroll row.
   * `grid` = flex cell for 2-column dashboard grid (no fixed width).
   */
  layout?: "strip" | "grid";
};

/** Single KPI card inside the horizontal strip or dashboard grid. */
export function KPITile({
  children,
  urgent,
  onPress,
  style,
  layout = "strip",
}: TileProps) {
  const c = useThemeColors();
  const border = urgent ? `${c.error}66` : c.border;
  const bg = urgent ? `${c.error}14` : c.surface;

  const sizing: ViewStyle =
    layout === "grid"
      ? {
          flexBasis: "47%",
          flexGrow: 1,
          minWidth: 0,
          maxWidth: "100%",
        }
      : { width: CARD_WIDTH };

  if (onPress) {
    return (
      <HapticPressable
        haptic="light"
        onPress={onPress}
        style={[
          styles.tile,
          sizing,
          { borderColor: border, backgroundColor: bg },
          style,
        ]}
      >
        {children}
      </HapticPressable>
    );
  }

  return (
    <View
      style={[
        styles.tile,
        sizing,
        { borderColor: border, backgroundColor: bg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type RowProps = {
  children: ReactNode;
};

/** Horizontally scrollable KPI strip (mobile-native). */
export default function KPIScrollRow({ children }: RowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + spacing.md}
      snapToAlignment="start"
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  tile: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
