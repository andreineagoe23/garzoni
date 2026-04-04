import { Stack } from "expo-router";

export default function PathLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Path",
      }}
    />
  );
}
