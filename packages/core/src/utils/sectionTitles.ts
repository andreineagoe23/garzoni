import type { TFunction } from "i18next";

/** Canonical English section titles from lesson_section_structure.py (lowercase key). */
const CANONICAL_SECTION_TITLE_KEYS: Record<string, string> = {
  overview: "courses.flow.sectionTitles.overview",
  "core concept": "courses.flow.sectionTitles.coreConcept",
  "applied insight": "courses.flow.sectionTitles.appliedInsight",
  "practical walkthrough": "courses.flow.sectionTitles.practicalWalkthrough",
  "key takeaways": "courses.flow.sectionTitles.keyTakeaways",
  "next steps": "courses.flow.sectionTitles.nextSteps",
  "knowledge check 1": "courses.flow.sectionTitles.knowledgeCheck1",
  "knowledge check 2": "courses.flow.sectionTitles.knowledgeCheck2",
  "watch & learn": "courses.flow.sectionTitles.watchAndLearn",
};

function normalizeUiLanguage(language?: string | null): string {
  if (!language) return "en";
  return language.split("-")[0].toLowerCase();
}

/**
 * Localize canonical lesson section headings when UI is Romanian.
 * Falls back to API title (already translated when X-App-Language=ro).
 */
export function localizeSectionTitle(
  title: string | undefined | null,
  t: TFunction,
  language?: string | null,
): string {
  const raw = (title ?? "").trim();
  if (!raw) return "";
  if (normalizeUiLanguage(language) !== "ro") return raw;
  const key = CANONICAL_SECTION_TITLE_KEYS[raw.toLowerCase()];
  if (key) return t(key);
  return raw;
}
