import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkPalette, lightPalette, type ThemeColors } from "./palettes";

const STORAGE_KEY = "garzoni:theme";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(
  mode: ThemeMode,
  system: "light" | "dark" | null | undefined
): "light" | "dark" {
  if (mode === "system") {
    return system === "dark" ? "dark" : "light";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  /** Match web `ThemeProvider`: dark-first when nothing stored (`prefers-color-scheme` default). */
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === "light" || raw === "dark" || raw === "system") {
          setModeState(raw);
        }
      } catch {
        /* ignore */
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    void AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggleDark = useCallback(() => {
    setModeState((prev) => {
      const sys = systemScheme === "dark" ? "dark" : "light";
      const currentlyDark = resolveMode(prev, sys) === "dark";
      const next: ThemeMode = currentlyDark ? "light" : "dark";
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, [systemScheme]);

  const resolved = resolveMode(mode, systemScheme);
  const colors = resolved === "dark" ? darkPalette : lightPalette;

  const value = useMemo(
    () => ({
      mode,
      resolved,
      colors,
      setMode,
      toggleDark,
    }),
    [mode, resolved, colors, setMode, toggleDark]
  );

  if (!hydrated) {
    return (
      <ThemeContext.Provider
        value={{
          mode: "dark",
          resolved: "dark",
          colors: darkPalette,
          setMode,
          toggleDark,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

/** Safe fallback when outside provider (e.g. tests). */
export function useThemeColors(): ThemeColors {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx.colors;
  const sys = Appearance.getColorScheme();
  return sys === "dark" ? darkPalette : lightPalette;
}
