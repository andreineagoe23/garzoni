import { create } from "zustand";
import { getStorageAdapter, storageGet } from "./storageAdapter";

// IMPORTANT GUARDRAIL:
// This store is UI-only. Do NOT put server-derived balances/counts here (e.g. heartsCount).
// Server truth lives in React Query (queryKeys.hearts()).

const STORAGE_KEY = "monevo:hearts:outOfHeartsUntilTs";

type HeartsStoreState = {
  isOutOfHeartsModalOpen: boolean;
  outOfHeartsUntilTs: number | null;
  lastSeenServerHeartsTs: number | null;
  setOutOfHeartsModalOpen: (open: boolean) => void;
  setOutOfHeartsUntilTs: (ts: number | null) => void;
  setLastSeenServerHeartsTs: (ts: number | null) => void;
  resetHeartsUi: () => void;
};

function parseTs(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readOutOfHeartsUntilTsSync(): number | null {
  try {
    const r = getStorageAdapter().getItem(STORAGE_KEY);
    if (r instanceof Promise) return null;
    return parseTs(r as string | null);
  } catch {
    return null;
  }
}

function writeOutOfHeartsUntilTs(value: number | null) {
  const a = getStorageAdapter();
  try {
    if (value == null) {
      void Promise.resolve(a.removeItem(STORAGE_KEY)).catch(() => {});
    } else {
      void Promise.resolve(a.setItem(STORAGE_KEY, String(value))).catch(() => {});
    }
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

const initialOutOfHeartsUntilTs = readOutOfHeartsUntilTsSync();

export const useHeartsStore = create<HeartsStoreState>((set) => ({
  // UI overlay state
  isOutOfHeartsModalOpen: false,
  // Cross-tab synced timestamp (ms) for when the user can proceed again.
  outOfHeartsUntilTs: initialOutOfHeartsUntilTs,
  // Optional: when we last saw a server hearts payload (used for countdown math).
  lastSeenServerHeartsTs: null,

  setOutOfHeartsModalOpen: (open) =>
    set({ isOutOfHeartsModalOpen: Boolean(open) }),

  setOutOfHeartsUntilTs: (ts) => {
    const next = ts == null ? null : Number(ts);
    writeOutOfHeartsUntilTs(Number.isFinite(next) ? next : null);
    set({ outOfHeartsUntilTs: Number.isFinite(next) ? next : null });
  },

  setLastSeenServerHeartsTs: (ts) => {
    const next = ts == null ? null : Number(ts);
    set({ lastSeenServerHeartsTs: Number.isFinite(next) ? next : null });
  },

  resetHeartsUi: () =>
    set({
      isOutOfHeartsModalOpen: false,
      outOfHeartsUntilTs: readOutOfHeartsUntilTsSync(),
      lastSeenServerHeartsTs: null,
    }),
}));

let didInitTabSync = false;

/**
 * Hydrates from async storage (if any) and subscribes to cross-tab `storage` events on web.
 */
export function initHeartsTabSync() {
  if (didInitTabSync) return;
  didInitTabSync = true;

  void storageGet(STORAGE_KEY).then((raw) => {
    const next = parseTs(raw);
    if (next != null) {
      useHeartsStore.setState({ outOfHeartsUntilTs: next });
    }
  });

  if (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readOutOfHeartsUntilTsSync();
      useHeartsStore.setState({ outOfHeartsUntilTs: next });
    });
  }
}
