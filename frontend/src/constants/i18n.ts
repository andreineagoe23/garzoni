export const LANGUAGE_STORAGE_KEY = "monevo:lang";

export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ro", label: "Romana" },
  { code: "es", label: "Espanol", comingSoon: true },
] as const;
