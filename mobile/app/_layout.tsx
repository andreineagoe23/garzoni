import { useEffect, useState } from "react";
import { router, Stack, usePathname, useSegments } from "expo-router";
import { LinkPreviewContextProvider } from "expo-router/build/link/preview/LinkPreviewContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, StyleSheet, Text, Platform, Dimensions } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { Sentry } from "../src/bootstrap/sentryMobile";
import Toast from "react-native-toast-message";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { i18n, queryClient } from "@garzoni/core";
import { AuthProvider, useAuthSession } from "../src/auth/AuthContext";
import { initHttpClientMobile } from "../src/bootstrap/httpClientMobile";
import {
  hydrateI18nLanguageMobile,
  initI18nMobile,
} from "../src/bootstrap/i18nMobile";
import { initCustomerIoMobile } from "../src/bootstrap/customerIoMobile";
import { initStorageMobile } from "../src/bootstrap/storageMobile";
import { initAnalyticsMobile } from "../src/bootstrap/analyticsMobile";
import OfflineBanner from "../src/components/common/OfflineBanner";
import { RootErrorBoundary } from "../src/components/common/RootErrorBoundary";
import { useNativeOnlineSync } from "../src/hooks/useNativeOnlineSync";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import { useShakeDetection } from "../src/hooks/useShakeDetection";
import ShakeFeedbackModal from "../src/components/feedback/ShakeFeedbackModal";
import ReviewPromptModal from "../src/components/review/ReviewPromptModal";
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { installGlobalInterFont } from "../src/theme/installFonts";
import { ensureAndroidNotificationChannels } from "../src/bootstrap/pushNotificationsMobile";

// Patch RN Text/TextInput once at module load so all text renders in Inter,
// mapping each fontWeight to the matching Inter face (see installFonts.ts).
installGlobalInterFont();

// Android drops any notification posted to a channel that does not exist, and
// locally scheduled reminders can fire long before push registration next runs.
// Creating the channels at boot decouples them from the 24h re-registration gate.
void ensureAndroidNotificationChannels();

/** Root route segments reachable without a session (pre-auth + legal/reset). */
const PUBLIC_ROOT_SEGMENTS = new Set([
  "(auth)",
  "welcome",
  "demo-lesson",
  "legal",
  "password-reset",
]);

function ThemedRoot() {
  const { resolved, colors } = useTheme();
  const { hydrated, accessToken } = useAuthSession();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [shakeModalVisible, setShakeModalVisible] = useState(false);
  useNativeOnlineSync();

  // Android edge-to-edge: the tab bar draws its own background behind the
  // system navigation bar, so we disable the contrast scrim (androidNavigationBar
  // .enforceContrast:false) to avoid a grey band on 3-button-nav phones. That
  // means we must drive the nav-bar button color ourselves so the icons stay
  // legible against `colors.bg` — light buttons on dark theme, dark on light.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void NavigationBar.setButtonStyleAsync(
      resolved === "dark" ? "light" : "dark",
    );
  }, [resolved]);

  // iOS phones are portrait-locked via Info.plist while the Android manifest
  // must stay orientation-unrestricted (Play flags manifest locks on Android
  // 16 large screens). Lock at runtime instead, but only on phone-sized
  // windows — tablets/unfolded foldables (smallest side ≥ 600dp) stay free,
  // matching the iPad behaviour.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const apply = ({ width, height }: { width: number; height: number }) => {
      void (Math.min(width, height) < 600
        ? ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          )
        : ScreenOrientation.unlockAsync());
    };
    apply(Dimensions.get("screen"));
    const sub = Dimensions.addEventListener("change", ({ screen }) =>
      apply(screen),
    );
    return () => sub.remove();
  }, []);

  // Global auth guard. Without it the only auth check lives in `index.tsx`
  // (the `/` route), so every other screen — tools, (tabs), chat — renders
  // with no token after logout, session expiry, or a deep link, firing
  // authenticated fetches that 401. Redirect any non-public route to /welcome
  // once we know there is no session. `/` (empty segments) runs its own
  // auth-aware redirect, so leave it alone.
  useEffect(() => {
    if (!hydrated || accessToken) return;
    const root = segments[0];
    if (root === undefined || PUBLIC_ROOT_SEGMENTS.has(root)) return;
    router.replace("/welcome");
  }, [hydrated, accessToken, segments]);

  useShakeDetection({
    onShake: () => setShakeModalVisible(true),
    enabled: true,
  });

  useEffect(() => {
    void initCustomerIoMobile();
  }, []);
  usePushNotifications(Boolean(accessToken));

  const navTheme = {
    ...(resolved === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolved === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
      primary: colors.text,
      notification: colors.primary,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
        <OfflineBanner />
        {/* Full-width host — screens handle their own responsive padding/grids
            (fluid layout). No global width cap, so the app fills the iPad. */}
        <View style={styles.stackHost}>
          <LinkPreviewContextProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                presentation: "card",
                // Header background matches page bg; text/back-button use readable text color.
                // Individual screens set headerShown:true but MUST NOT set headerTintColor:primary.
                headerStyle: { backgroundColor: colors.bg },
                headerTitleStyle: {
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: "600",
                },
                headerTintColor: colors.text,
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen
                name="(tabs)"
                options={{ title: "Home", gestureEnabled: false }}
              />
              <Stack.Screen name="lesson" options={{ headerShown: false }} />
              <Stack.Screen name="course" options={{ headerShown: false }} />
              <Stack.Screen name="flow" options={{ headerShown: false }} />
              <Stack.Screen name="path" options={{ headerShown: false }} />
              <Stack.Screen name="quiz" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="push-prompt"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="change-password"
                options={{ headerShown: true, title: "Change password" }}
              />
              <Stack.Screen name="feedback" options={{ headerShown: false }} />
              <Stack.Screen
                name="payment-success"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="subscriptions"
                options={{ headerShown: true }}
              />
              {/* Explicitly registered so gestureEnabled + presentation apply */}
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen
                name="voice-chat"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="missions" options={{ headerShown: false }} />
              <Stack.Screen
                name="leaderboard"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="rewards" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="support" options={{ headerShown: false }} />
              <Stack.Screen
                name="personalized-path"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="welcome"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="demo-lesson"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="scan" options={{ headerShown: false }} />
              <Stack.Screen name="legal" options={{ headerShown: false }} />
              <Stack.Screen
                name="password-reset/[uidb64]/[token]"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="tools" options={{ headerShown: false }} />
            </Stack>
          </LinkPreviewContextProvider>
        </View>
        <ShakeFeedbackModal
          visible={shakeModalVisible}
          currentRoute={pathname}
          onDismiss={() => setShakeModalVisible(false)}
        />
        <ReviewPromptModal />
        <Toast topOffset={insets.top + 8} />
      </View>
    </NavigationThemeProvider>
  );
}

function RootLayout() {
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [fontsLoaded] = useInter({
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    void (async () => {
      try {
        initStorageMobile();
        initI18nMobile();
        await hydrateI18nLanguageMobile();
        initHttpClientMobile();
        initAnalyticsMobile();
        setBootstrapReady(true);
      } catch (e) {
        setBootstrapError(
          e instanceof Error ? e.message : "Failed to initialize app services.",
        );
      }
    })();
  }, []);

  if (bootstrapError) {
    return (
      <View style={[styles.root, styles.bootstrapFallback]}>
        <Text style={styles.bootstrapTitle}>App failed to start</Text>
        <Text style={styles.bootstrapBody}>{bootstrapError}</Text>
      </View>
    );
  }

  if (!bootstrapReady || !fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <RootErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <View style={styles.root}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <SafeAreaProvider>
                  <ThemedRoot />
                </SafeAreaProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </View>
      </I18nextProvider>
    </RootErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: { flex: 1 },
  stackHost: { flex: 1 },
  bootstrapFallback: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0b1020",
  },
  bootstrapTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  bootstrapBody: {
    color: "#d1d5db",
    fontSize: 14,
    textAlign: "center",
  },
});
