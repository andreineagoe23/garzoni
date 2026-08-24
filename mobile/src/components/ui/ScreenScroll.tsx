import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Platform,
  RefreshControl,
  type RefreshControlProps,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useResponsive } from "../../utils/platform";

export type ScreenScrollProps = ScrollViewProps & {
  children: ReactNode;
  /** Extra bottom padding for tab bar (default 72). Omit by passing 0. */
  contentPaddingBottom?: number;
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * Apply the responsive tablet gutter (extra horizontal padding) on iPad.
   * Fluid — content still fills the width, it just isn't edge-to-edge. No-op on
   * phone, so the iPhone layout is unchanged. Default: true.
   */
  tabletGutter?: boolean;
};

/**
 * Vertical screen scroll with bounded height (`flex: 1`) so content scrolls inside tab/stack
 * layouts. Enables nested horizontal scroll on Android.
 *
 * iOS quirk fix: screens already use `TabScreenHeader` (which pads `paddingTop: insets.top`),
 * so UIScrollView's automatic insets MUST be off. We force:
 *   - `contentInsetAdjustmentBehavior: "never"`
 *   - `automaticallyAdjustContentInsets: false`
 *   - explicit zero `contentInset` + `scrollIndicatorInsets`
 * Without these, returning from a stack/modal route can leave a large blank band between the
 * header and the first card because iOS remembers the inset state from the previous screen.
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
      tabletGutter = true,
      ...rest
    },
    ref,
  ) {
    // Tapping the active tab returns to the top of that screen — the standard
    // mobile affordance, and the one people reach for after scrolling a long
    // list. React Navigation drives it off a ref, so keep an internal one and
    // re-expose it to any caller that also forwards a ref.
    const innerRef = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => innerRef.current as ScrollView, []);
    useScrollToTop(innerRef);

    const { isTablet, gutter } = useResponsive();
    // Fluid tablet gutter: extra horizontal padding on iPad only. 0 on phone,
    // so the iPhone layout is byte-for-byte unchanged.
    const gutterStyle =
      tabletGutter && isTablet && gutter > 0
        ? { paddingHorizontal: gutter }
        : null;

    const bottomPad =
      typeof contentPaddingBottom === "number" && contentPaddingBottom > 0
        ? { paddingBottom: contentPaddingBottom }
        : {};

    const insetAdjustment =
      Platform.OS === "ios"
        ? (contentInsetAdjustmentBehavior ?? "never")
        : contentInsetAdjustmentBehavior;

    return (
      <ScrollView
        ref={innerRef}
        style={[styles.flex, style]}
        contentContainerStyle={[contentContainerStyle, gutterStyle, bottomPad]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        nestedScrollEnabled={nestedScrollEnabled}
        // iOS: prevent stale contentInset from a previous nav bar / header state
        // bleeding into a tab screen after returning from a stack route.
        automaticallyAdjustContentInsets={
          Platform.OS === "ios" ? false : undefined
        }
        contentInset={Platform.OS === "ios" ? { top: 0, bottom: 0 } : undefined}
        scrollIndicatorInsets={
          Platform.OS === "ios" ? { top: 0, bottom: 0 } : undefined
        }
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
