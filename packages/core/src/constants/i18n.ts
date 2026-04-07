export const LANGUAGE_STORAGE_KEY = "garzoni:lang";

export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ro", label: "Română" },
  { code: "es", label: "Español", comingSoon: true },
] as const;
