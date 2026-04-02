/// <reference types="vitest/globals" />

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

import "./i18n";

const g = globalThis as Record<string, unknown>;
g.jest = {
  fn: vi.fn,
  mock: vi.mock,
  spyOn: vi.spyOn,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  requireActual: vi.importActual,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
};
