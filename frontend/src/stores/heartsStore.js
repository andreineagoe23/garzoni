import { create } from "zustand";

// IMPORTANT GUARDRAIL:
// This store is UI-only. Do NOT put server-derived balances/counts here (e.g. heartsCount).
// Server truth lives in React Query (queryKeys.hearts()).

const STORAGE_KEY = "monevo:hearts:outOfHeartsUntilTs";

function readOutOfHeartsUntilTs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeOutOfHeartsUntilTs(value) {
  try {
    if (value == null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

const initialOutOfHeartsUntilTs = readOutOfHeartsUntilTs();

export const useHeartsStore = create((set) => ({
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
      outOfHeartsUntilTs: readOutOfHeartsUntilTs(),
      lastSeenServerHeartsTs: null,
    }),
}));

let didInitTabSync = false;

export function initHeartsTabSync() {
  if (didInitTabSync) return;
  didInitTabSync = true;

  // Keep outOfHeartsUntilTs synced across tabs.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const next = readOutOfHeartsUntilTs();
    // IMPORTANT: do not write back to storage here (avoid ping-pong across tabs).
    useHeartsStore.setState({ outOfHeartsUntilTs: next });
  });
}
