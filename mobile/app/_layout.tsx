import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "@monevo/core";
import { AuthProvider } from "../src/auth/AuthContext";
import { initHttpClientMobile } from "../src/bootstrap/httpClientMobile";
import { initI18nMobile } from "../src/bootstrap/i18nMobile";
import { initStorageMobile } from "../src/bootstrap/storageMobile";
import OfflineBanner from "../src/components/common/OfflineBanner";
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";

initStorageMobile();
initHttpClientMobile();
initI18nMobile();

function ThemedRoot() {
  const { resolved, colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <OfflineBanner />
      <View style={styles.stackHost}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lesson" options={{ headerShown: false }} />
          <Stack.Screen name="course" options={{ headerShown: false }} />
          <Stack.Screen name="quiz" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="change-password"
            options={{ headerShown: true, title: "Change password" }}
          />
        </Stack>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedRoot />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stackHost: { flex: 1 },
});
