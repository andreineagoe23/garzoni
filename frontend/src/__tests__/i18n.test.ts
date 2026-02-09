import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

const loadJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));

const flattenKeys = (obj: Record<string, unknown>, prefix = ""): string[] => {
  const keys: string[] = [];
  Object.entries(obj).forEach(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, next));
      return;
    }
    keys.push(next);
  });
  return keys;
};

const getAllLocaleKeys = (locale: "en" | "ro") => {
  const common = loadJson(`locales/${locale}/common.json`);
  const shared = loadJson(`locales/${locale}/shared.json`);
  const courses = loadJson(`locales/${locale}/courses.json`);
  const merged = {
    ...common,
    shared,
    courses,
  };
  return new Set(flattenKeys(merged));
};

const findUsedKeys = () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    fs.readdirSync(dir).forEach((entry) => {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (full.includes(`${path.sep}__tests__`) || full.includes(`${path.sep}test-utils`)) {
          return;
        }
        walk(full);
        return;
      }
      if (full.endsWith(".ts") || full.endsWith(".tsx")) {
        files.push(full);
      }
    });
  };
  walk(ROOT);

  const keyPattern = /\b(?:t|i18n\.t)\(\s*["']([^"']+)["']/g;
  const transPattern = /i18nKey="([^"]+)"/g;
  const used = new Set<string>();
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = keyPattern.exec(text)) !== null) {
      used.add(match[1]);
    }
    while ((match = transPattern.exec(text)) !== null) {
      used.add(match[1]);
    }
  });
  return used;
};

describe("i18n coverage", () => {
  test("EN and RO locales have identical keys", () => {
    const enKeys = getAllLocaleKeys("en");
    const roKeys = getAllLocaleKeys("ro");
    const missingInRo = [...enKeys].filter((key) => !roKeys.has(key));
    const extraInRo = [...roKeys].filter((key) => !enKeys.has(key));
    expect(missingInRo).toEqual([]);
    expect(extraInRo).toEqual([]);
  });

  test("all referenced i18n keys exist in EN locale", () => {
    const enKeys = getAllLocaleKeys("en");
    const used = findUsedKeys();
    const missing = [...used].filter((key) => !enKeys.has(key));
    expect(missing).toEqual([]);
  });

  test("no hardcoded defaultValue in translation calls", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      fs.readdirSync(dir).forEach((entry) => {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (full.includes(`${path.sep}__tests__`) || full.includes(`${path.sep}test-utils`)) {
            return;
          }
          walk(full);
          return;
        }
        if (full.endsWith(".ts") || full.endsWith(".tsx")) {
          files.push(full);
        }
      });
    };
    walk(ROOT);

    const offenders: string[] = [];
    files.forEach((file) => {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("defaultValue:")) {
        offenders.push(file);
      }
    });

    expect(offenders).toEqual([]);
  });
});
