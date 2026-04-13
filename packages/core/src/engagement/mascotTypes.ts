export type MascotMood = "celebrate" | "encourage" | "neutral";
export type MascotType = "owl" | "bull" | "bear";

export const MOOD_TO_MASCOT: Record<MascotMood, MascotType> = {
  celebrate: "owl",
  encourage: "bull",
  neutral: "bear",
};
