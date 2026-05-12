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

  void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((raw) => {
    const lng = normalizeLanguage(raw ?? undefined);
    if (lng && lng !== i18n.language) {
      void i18n.changeLanguage(lng);
    }
  });
}
