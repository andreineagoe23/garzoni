import { Stack } from "expo-router";

export default function CourseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Course",
      }}
    />
  );
}
