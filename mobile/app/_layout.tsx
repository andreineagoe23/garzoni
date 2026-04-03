import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { View, StyleSheet } from "react-native";
import { queryClient } from "@monevo/core";
import { AuthProvider } from "../src/auth/AuthContext";
import { initHttpClientMobile } from "../src/bootstrap/httpClientMobile";
import { initI18nMobile } from "../src/bootstrap/i18nMobile";
import { initStorageMobile } from "../src/bootstrap/storageMobile";
import OfflineBanner from "../src/components/common/OfflineBanner";

initStorageMobile();
initHttpClientMobile();
initI18nMobile();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <View style={styles.root}>
          <OfflineBanner />
          {/* Stack must live in a flex:1 child or it can collapse to zero height (blank white screen). */}
          <View style={styles.stackHost}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="lesson" options={{ headerShown: false }} />
              <Stack.Screen name="course" options={{ headerShown: false }} />
              <Stack.Screen name="quiz" options={{ headerShown: false }} />
              <Stack.Screen
                name="change-password"
                options={{ headerShown: true, title: "Change password" }}
              />
            </Stack>
          </View>
        </View>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stackHost: { flex: 1 },
});
