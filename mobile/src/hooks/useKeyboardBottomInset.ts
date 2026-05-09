import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Tracks keyboard height for **`ScrollView` `contentContainerStyle.paddingBottom`** inside
 * **Modal + animated bottom sheets**. Prefer this over translating the whole sheet by the
 * keyboard height (that warps layout under the status bar).
 *
 * Prefer **`KeyboardAwareScrollView`** / **`useFormKeyboardPadding`** for forms; **`chat`** keeps
 * `KeyboardAvoidingView` for the split composer + messages layout.
 *
 * @param visible When false, inset resets to 0 (parent modal closed).
 */
export function useKeyboardBottomInset(visible: boolean): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  return height;
}
