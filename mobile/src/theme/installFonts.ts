import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
} from "react-native";

/**
 * Global Inter font installer.
 *
 * The app uses raw `<Text>`/`<TextInput>` in 140+ files with inline
 * `fontWeight` (700/600/800/…) and no `fontFamily`. React Native does NOT map
 * `fontWeight` onto custom (non-system) fonts — each weight is a separate font
 * file. So we can't just set one default family: that would flatten every bold
 * heading to regular.
 *
 * Instead we patch `Text.render`/`TextInput.render` once at module load to read
 * each element's resolved `fontWeight` (+ `fontStyle`) and inject the matching
 * Inter face. Elements that already declare an explicit `fontFamily` (mono /
 * display tokens in `brand.ts`) are left untouched.
 *
 * Inter faces must be loaded in `app/_layout.tsx` via `@expo-google-fonts/inter`.
 */

/**
 * Global cap on the OS "Font size" accessibility multiplier. Android OEMs ship
 * different default font sizes (and a separate Display Size zoom), so uncapped
 * scaling makes the same screen look different on every phone and overflows
 * fixed-height layouts. We still honour large-font users up to this factor, but
 * refuse to blow the layout apart beyond it. iOS uses the same cap for parity.
 */
export const MAX_FONT_SCALE = 1.25;

type Weight = TextStyle["fontWeight"];

function interFamily(weight: Weight, italic: boolean): string {
  if (italic) {
    // Only the regular italic face is loaded; faux-bold italics fall back to it.
    return "Inter_400Regular_Italic";
  }
  switch (String(weight ?? "400")) {
    case "100":
    case "200":
    case "300":
    case "400":
    case "normal":
      return "Inter_400Regular";
    case "500":
      return "Inter_500Medium";
    case "600":
      return "Inter_600SemiBold";
    case "700":
    case "bold":
      return "Inter_700Bold";
    case "800":
    case "900":
      return "Inter_800ExtraBold";
    default:
      return "Inter_400Regular";
  }
}

let installed = false;

export function installGlobalInterFont(): void {
  if (installed) return;
  installed = true;

  for (const Component of [Text, TextInput] as const) {
    // RN core components are forwardRef objects exposing a `render(props, ref)`.
    const target = Component as unknown as {
      render?: (props: Record<string, unknown>, ref: unknown) => unknown;
    };
    const originalRender = target.render;
    if (typeof originalRender !== "function") continue;

    target.render = function patchedRender(props, ref) {
      const flat = (StyleSheet.flatten((props as { style?: unknown }).style) ??
        {}) as TextStyle;

      const patch: TextStyle = {};
      // Respect explicit font families (mono / display tokens, icon fonts).
      if (!flat.fontFamily) {
        patch.fontFamily = interFamily(
          flat.fontWeight,
          flat.fontStyle === "italic",
        );
      }
      // Android reserves extra ascent/descent per line by default, which makes
      // text sit low inside buttons/chips compared to iOS. Strip it for iOS
      // vertical-metrics parity unless a style opts back in.
      if (Platform.OS === "android" && flat.includeFontPadding === undefined) {
        patch.includeFontPadding = false;
      }
      // Clamp OS font scaling globally unless a call site sets its own cap.
      // This is a prop (not a style), so apply it even when no style patch is
      // needed. `maxFontSizeMultiplier: 0` means "unlimited" in RN, so treat
      // only `undefined` as "not set".
      const capFontScale =
        (props as { maxFontSizeMultiplier?: number }).maxFontSizeMultiplier ===
        undefined;

      if (Object.keys(patch).length === 0 && !capFontScale) {
        return originalRender.call(this, props, ref);
      }

      const nextProps: Record<string, unknown> = {
        ...props,
        style: [(props as { style?: unknown }).style, patch],
      };
      if (capFontScale) {
        nextProps.maxFontSizeMultiplier = MAX_FONT_SCALE;
      }
      return originalRender.call(this, nextProps, ref);
    };
  }
}
