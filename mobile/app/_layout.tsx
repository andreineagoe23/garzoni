import { useEffect, useState } from "react";
import { Stack, usePathname } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, StyleSheet, Text } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { i18n, queryClient } from "@garzoni/core";
import { AuthProvider } from "../src/auth/AuthContext";
import { initHttpClientMobile } from "../src/bootstrap/httpClientMobile";
import { initI18nMobile } from "../src/bootstrap/i18nMobile";
import { initCustomerIoMobile } from "../src/bootstrap/customerIoMobile";
import { initStorageMobile } from "../src/bootstrap/storageMobile";
import OfflineBanner from "../src/components/common/OfflineBanner";
import { RootErrorBoundary } from "../src/components/common/RootErrorBoundary";
import { useNativeOnlineSync } from "../src/hooks/useNativeOnlineSync";
import { useShakeDetection } from "../src/hooks/useShakeDetection";
import ShakeFeedbackModal from "../src/components/feedback/ShakeFeedbackModal";
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";

function ThemedRoot() {
  const { resolved, colors } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [shakeModalVisible, setShakeModalVisible] = useState(false);
  useNativeOnlineSync();

  useShakeDetection({
    onShake: () => setShakeModalVisible(true),
    enabled: true,
  });

  useEffect(() => {
    void initCustomerIoMobile();
  }, []);

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
        <View style={styles.stackHost}>
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
            <Stack.Screen name="(tabs)" options={{ title: "Home", gestureEnabled: false }} />
            <Stack.Screen name="lesson" options={{ headerShown: false }} />
            <Stack.Screen name="course" options={{ headerShown: false }} />
            <Stack.Screen name="flow" options={{ headerShown: false }} />
            <Stack.Screen name="path" options={{ headerShown: false }} />
            <Stack.Screen name="quiz" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
            <Stack.Screen name="voice-chat" options={{ headerShown: false }} />
            <Stack.Screen name="missions" options={{ headerShown: false }} />
            <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
            <Stack.Screen name="rewards" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false }} />
            <Stack.Screen name="referral" options={{ headerShown: false }} />
            <Stack.Screen name="personalized-path" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="scan" options={{ headerShown: false }} />
            <Stack.Screen name="legal" options={{ headerShown: false }} />
            <Stack.Screen name="password-reset/[uidb64]/[token]" options={{ headerShown: false }} />
            <Stack.Screen name="tools" options={{ headerShown: false }} />
          </Stack>
        </View>
        <ShakeFeedbackModal
          visible={shakeModalVisible}
          currentRoute={pathname}
          onDismiss={() => setShakeModalVisible(false)}
        />
        <Toast topOffset={insets.top + 8} />
      </View>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    try {
      initStorageMobile();
      initHttpClientMobile();
      initI18nMobile();
      setBootstrapReady(true);
    } catch (e) {
      setBootstrapError(
        e instanceof Error ? e.message : "Failed to initialize app services.",
      );
    }
  }, []);

  if (bootstrapError) {
    return (
      <View style={[styles.root, styles.bootstrapFallback]}>
        <Text style={styles.bootstrapTitle}>App failed to start</Text>
        <Text style={styles.bootstrapBody}>
          {bootstrapError}
        </Text>
      </View>
    );
  }

  if (!bootstrapReady) {
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
