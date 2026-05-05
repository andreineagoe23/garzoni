import { forwardRef, type ReactElement, type ReactNode } from "react";
import {
  Platform,
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
 *
 * iOS: defaults `contentInsetAdjustmentBehavior` to `never` so the system does not add an extra
 * top safe-area inset to scroll *content* when screens already use `TabScreenHeader` (which pads
 * `paddingTop: insets.top`). Without this, returning from stack/modal routes can leave a large
 * blank band between the header and the first card.
 */
const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(
  function ScreenScroll(
    {
      children,
      style,
      contentContainerStyle,
      contentPaddingBottom = 72,
      contentInsetAdjustmentBehavior,
      keyboardShouldPersistTaps = "handled",
      keyboardDismissMode = "on-drag",
      showsVerticalScrollIndicator = true,
      nestedScrollEnabled = true,
      ...rest
    },
    ref,
  ) {
    const bottomPad =
      typeof contentPaddingBottom === "number" && contentPaddingBottom > 0
        ? { paddingBottom: contentPaddingBottom }
        : {};

    const insetAdjustment =
      Platform.OS === "ios"
        ? contentInsetAdjustmentBehavior ?? "never"
        : contentInsetAdjustmentBehavior;

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
        contentInsetAdjustmentBehavior={insetAdjustment}
      >
        {children}
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default ScreenScroll;
