import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../theme/tokens";
import { useKeyboardBottomInset } from "./useKeyboardBottomInset";

/**
 * Extra bottom padding for scroll/list content: keyboard height + safe-area bottom.
 * Use with **`keyboardActive={visible}`** for modals, or default **`true`** for full-screen forms.
 *
 * Prefer **`KeyboardAwareScrollView`** when you can replace `ScrollView`; use this hook for
 * **`FlatList`** / **`SectionList`** `contentContainerStyle`.
 */
export function useFormKeyboardPadding(keyboardActive = true): number {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardBottomInset(keyboardActive);

  return useMemo(
    () => keyboardInset + Math.max(insets.bottom, spacing.sm),
    [keyboardInset, insets.bottom],
  );
}
