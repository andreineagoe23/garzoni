import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";

initStorageMobile();
initHttpClientMobile();
initI18nMobile();

function ThemedRoot() {
  const { resolved, colors } = useTheme();
  useNativeOnlineSync();

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
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" options={{ title: "Home" }} />
            <Stack.Screen name="lesson" options={{ headerShown: false }} />
            <Stack.Screen name="course" options={{ headerShown: false }} />
            <Stack.Screen name="flow" options={{ headerShown: false }} />
            <Stack.Screen name="path" options={{ headerShown: false }} />
            <Stack.Screen name="quiz" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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
          </Stack>
        </View>
        <Toast />
      </View>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
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
});
