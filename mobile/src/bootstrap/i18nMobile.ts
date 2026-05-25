import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LANGUAGE,
  initGarzoniI18n,
  i18n,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  queryClient,
  setAppLanguageResolver,
} from "@garzoni/core";

let initialized = false;

/** Query roots whose data depends on `X-App-Language` / curriculum translations. */
const CURRICULUM_QUERY_ROOTS = new Set<string>([
  "learningPaths",
  "progressSummary",
  "personalizedPath",
  "exercises",
  "exerciseCategories",
  "courseFlow",
  "lessonsWithProgress",
  "learningPathCourses",
  "exercise",
  "exerciseProgress",
  "courseQuiz",
  "reviewQueue",
  "masterySummary",
  "recentActivity",
]);

function invalidateCurriculumQueries() {
  void queryClient.invalidateQueries({
    predicate: (q) => {
      const root = q.queryKey[0];
      return typeof root === "string" && CURRICULUM_QUERY_ROOTS.has(root);
    },
  });
}

export function initI18nMobile() {
  if (initialized) return;
  initialized = true;

  initGarzoniI18n({
    getInitialLanguage: () => DEFAULT_LANGUAGE,
    persistLanguage: (language) => {
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    },
    onLanguageChangedUI: () => {
      invalidateCurriculumQueries();
    },
  });

  setAppLanguageResolver(() => i18n.language);
}

/** Load persisted language before curriculum API calls (avoids en cache on cold start). */
export async function hydrateI18nLanguageMobile(): Promise<void> {
  initI18nMobile();
  const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const lng = normalizeLanguage(raw ?? undefined);
  if (lng !== i18n.language) {
    await i18n.changeLanguage(lng);
  }
}
