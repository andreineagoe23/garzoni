import { forwardRef, type ReactElement, type ReactNode } from "react";
import {
  RefreshControl,
  type RefreshControlProps,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from "react-native";

export type ScreenScrollProps = ScrollViewProps & {
  children: ReactNode;
  /** Extra bottom padding for tab bar (default 72). Omit by passing 0. */
  contentPaddingBottom?: number;
  refreshControl?: ReactElement<RefreshControlProps>;
};

/**
 * Vertical screen scroll with bounded height (`flex: 1`) so content scrolls inside tab/stack
 * layouts. Enables nested horizontal scroll on Android.
 */
const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(function ScreenScroll(
  {
    children,
    style,
    contentContainerStyle,
    contentPaddingBottom = 72,
    keyboardShouldPersistTaps = "handled",
    keyboardDismissMode = "on-drag",
    showsVerticalScrollIndicator = true,
    nestedScrollEnabled = true,
    ...rest
  },
  ref
) {
  const bottomPad =
    typeof contentPaddingBottom === "number" && contentPaddingBottom > 0
      ? { paddingBottom: contentPaddingBottom }
      : {};

  return (
    <ScrollView
      ref={ref}
      style={[styles.flex, style]}
      contentContainerStyle={[contentContainerStyle, bottomPad]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      nestedScrollEnabled={nestedScrollEnabled}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default ScreenScroll;
