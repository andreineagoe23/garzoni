import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import HapticPressable from "../ui/HapticPressable";
import { spacing, radius } from "../../theme/tokens";
import { gridFlexBasis, useResponsive } from "../../utils/platform";

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
  const { isTablet, gridColumns } = useResponsive();
  const border = urgent ? `${c.error}66` : c.border;
  const bg = urgent ? `${c.error}14` : c.surface;

  // Phone keeps the exact original 2-up "47%" basis (unchanged). Tablet: 3-up.
  // Large tablet (landscape / 12.9"): 4-up.
  const gridBasis = isTablet ? gridFlexBasis(gridColumns(3, 3, 4)) : "47%";

  const sizing: ViewStyle =
    layout === "grid"
      ? {
          flexBasis: gridBasis,
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
      style={styles.scroller}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Horizontal ScrollViews default to `flexGrow: 1`; hug the content so this
  // never steals leftover vertical space when dropped into a flex column.
  scroller: { flexGrow: 0, flexShrink: 0 },
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
