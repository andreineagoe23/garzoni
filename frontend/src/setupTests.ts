/// <reference types="vitest/globals" />

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

import "./i18n";

process.env.VITE_CLOUDINARY_CLOUD_NAME =
  process.env.VITE_CLOUDINARY_CLOUD_NAME || "test-cloud";

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
