/**
 * Pluggable persistence for @garzoni/core stores (localStorage on web, SecureStore on native).
 * Default implementation uses localStorage when `window` exists; no-ops otherwise.
 */

export type StorageAdapter = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const memory = new Map<string, string>();

const defaultWebAdapter: StorageAdapter = {
  getItem: (key) => {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof localStorage === "undefined") {
        memory.set(key, value);
        return;
      }
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem: (key) => {
    try {
      memory.delete(key);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  },
};

let adapter: StorageAdapter = defaultWebAdapter;

export function configureStorage(next: StorageAdapter): void {
  adapter = next;
}

export function getStorageAdapter(): StorageAdapter {
  return adapter;
}

/** Resolve getItem to a value (supports async adapters). */
export function storageGet(key: string): Promise<string | null> {
  return Promise.resolve(adapter.getItem(key)).then((v) =>
    v == null ? null : String(v),
  );
}

export function storageSet(key: string, value: string): Promise<void> {
  return Promise.resolve(adapter.setItem(key, value)).then(() => undefined);
}

export function storageRemove(key: string): Promise<void> {
  return Promise.resolve(adapter.removeItem(key)).then(() => undefined);
}
