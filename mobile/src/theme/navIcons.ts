/**
 * Map web (Lucide-style) conceptual names to Ionicons for consistent nav vocabulary.
 */
export const navIcons = {
  home: "home-outline",
  homeFilled: "home",
  learn: "book-outline",
  learnFilled: "book",
  exercises: "barbell-outline",
  exercisesFilled: "barbell",
  missions: "flag-outline",
  missionsFilled: "flag",
  profile: "person-circle-outline",
  profileFilled: "person-circle",
  leaderboard: "trophy-outline",
  rewards: "gift-outline",
  tools: "construct-outline",
  toolsFilled: "construct",
  support: "help-circle-outline",
  settings: "settings-outline",
  billing: "card-outline",
  legal: "document-text-outline",
  chat: "chatbubble-ellipses-outline",
  menu: "menu-outline",
  chevronForward: "chevron-forward",
  sun: "sunny-outline",
  moon: "moon-outline",
} as const;

export type NavIconKey = keyof typeof navIcons;
