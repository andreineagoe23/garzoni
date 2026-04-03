import { Stack } from "expo-router";
import { colors } from "../../src/theme/tokens";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen
        name="forgot-password"
        options={{ headerShown: true, title: "Reset password" }}
      />
    </Stack>
  );
}
