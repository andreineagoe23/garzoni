export type UserLevel = "beginner" | "intermediate" | "advanced";

export function getUserLevel(points: number): UserLevel {
  if (points >= 2500) return "advanced";
  if (points >= 750) return "intermediate";
  return "beginner";
}
