import { useState, useEffect, useCallback } from "react";

const PREFERENCES_KEY = "monevo:dashboard-preferences";

const DEFAULT_PREFERENCES = {
  showWeakSkills: true,
  defaultSort: "default",
  remindAboutReviews: false,
  reducedMotion: false,
};

/**
 * Hook for managing dashboard user preferences
 */
export const usePreferences = () => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.warn("Failed to load preferences:", error);
    }
  }, []);

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn("Failed to save preferences:", error);
      }
      return updated;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(PREFERENCES_KEY);
    } catch (error) {
      console.warn("Failed to reset preferences:", error);
    }
  }, []);

  return { preferences, updatePreference, resetPreferences };
};
