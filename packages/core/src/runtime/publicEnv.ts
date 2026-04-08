/**
 * Read public env vars across Vite (import.meta.env), CRA-style (REACT_APP_*),
 * Expo (EXPO_PUBLIC_*), and Node (process.env).
 *
 * Kept under `runtime/` (not `env/`) so the path is not ignored by root `.gitignore` rules for Python venvs.
 */
function expoKeyFromViteOrReact(key: string): string | null {
  if (key.startsWith("VITE_")) {
    return `EXPO_PUBLIC_${key.slice("VITE_".length)}`;
  }
  if (key.startsWith("REACT_APP_")) {
    return `EXPO_PUBLIC_${key.slice("REACT_APP_".length)}`;
  }
  return null;
}

export function readPublicEnv(...keys: string[]): string | undefined {
  const candidates: string[] = [];
  for (const key of keys) {
    candidates.push(key);
    const expo = expoKeyFromViteOrReact(key);
    if (expo && !candidates.includes(expo)) {
      candidates.push(expo);
    }
  }

  try {
    const env = (
      import.meta as ImportMeta & {
        env?: Record<string, string | boolean | undefined>;
      }
    ).env;
    if (env) {
      for (const k of candidates) {
        const v = env[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          return String(v);
        }
      }
    }
  } catch {
    // import.meta unavailable (e.g. some test runners)
  }

  if (typeof process !== "undefined" && process.env) {
    for (const k of candidates) {
      const v = process.env[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return v;
      }
    }
  }

  return undefined;
}
