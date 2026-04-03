import { router } from "expo-router";

export const routes = {
  tabs: () => router.replace("/(tabs)"),
  dashboard: () => router.push("/(tabs)"),
  learn: () => router.push("/(tabs)/learn"),
  profile: () => router.push("/(tabs)/profile"),
  login: () => router.replace("/(auth)/login"),
  register: () => router.push("/(auth)/register"),
  forgotPassword: () => router.push("/(auth)/forgot-password"),
  lesson: (id: number | string) => router.push(`/lesson/${id}`),
  course: (id: number | string) => router.push(`/course/${id}`),
} as const;
