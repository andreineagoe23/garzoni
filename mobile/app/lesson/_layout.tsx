import { Stack } from "expo-router";

export default function LessonLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Lesson",
      }}
    />
  );
}
