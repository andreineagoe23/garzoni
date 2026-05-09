import { forwardRef } from "react";
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardBottomInset } from "../../hooks/useKeyboardBottomInset";
import { spacing } from "../../theme/tokens";

export type KeyboardAwareScrollViewProps = ScrollViewProps & {
  /**
   * When false, no keyboard inset (e.g. modal `visible={false}` keeps listeners off).
   * Default **true** for full-screen routes.
   */
  keyboardActive?: boolean;
  /**
   * Base padding before keyboard + safe bottom (e.g. design token `spacing.xl`).
   * Final bottom padding = `basePaddingBottom + keyboard + safe bottom`.
   */
  basePaddingBottom?: number;
};

/**
 * Drop-in **`ScrollView`** for forms: keyboard height + home-indicator inset as bottom padding,
 * consistent dismiss mode. Use inside **stack screens** (`keyboardActive` default) or **modals**
 * (`keyboardActive={visible}`).
 *
 * For **`FlatList`**, use **`useFormKeyboardPadding`** on `contentContainerStyle` instead.
 */
const KeyboardAwareScrollView = forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(function KeyboardAwareScrollView(
  {
    keyboardActive = true,
    basePaddingBottom = 0,
    contentContainerStyle,
    keyboardDismissMode,
    keyboardShouldPersistTaps = "handled",
    style,
    ...rest
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset(keyboardActive);
  const bottomPad =
    basePaddingBottom +
    keyboardInset +
    Math.max(insets.bottom, spacing.sm);

  return (
    <ScrollView
      ref={ref}
      style={[styles.flex, style]}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={
        keyboardDismissMode ??
        (Platform.OS === "ios" ? "interactive" : "on-drag")
      }
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default KeyboardAwareScrollView;
