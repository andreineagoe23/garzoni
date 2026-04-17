import { type ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authBrand } from "../../theme/authBrand";
import { brand } from "../../theme/brand";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/tokens";

export type AuthHeroMode = "login" | "register" | "minimal";

type Props = {
  mode: AuthHeroMode;
  /** When set (e.g. from `Images.loginBg`), shown full-screen behind overlay. */
  backgroundUri?: string;
  children: ReactNode;
};

/**
 * Shared auth background: hero photo (login/register) or solid fallback, plus scrim when a photo is shown.
 */
export default function AuthScreenLayout({
  mode,
  backgroundUri,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { resolved } = useTheme();
  const showPhoto = Boolean(backgroundUri) && mode !== "minimal";
  const isDark = resolved === "dark";

  return (
    <View style={styles.root}>
      {showPhoto ? (
        <Image
          source={{ uri: backgroundUri as string }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? brand.bgDark : "#f8fafc",
            },
          ]}
        >
          {isDark ? (
            <View
              style={[StyleSheet.absoluteFill, styles.heroTint]}
              pointerEvents="none"
            />
          ) : null}
        </View>
      )}
      {showPhoto ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      ) : null}

      <View
        style={[
          styles.inner,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingHorizontal: spacing.xxl,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { backgroundColor: authBrand.overlay },
  heroTint: {
    backgroundColor: "rgba(29, 83, 48, 0.18)",
  },
  inner: {
    flex: 1,
  },
});
