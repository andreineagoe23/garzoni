/**
 * Shared navigate spy for tests that assert SPA navigation (Vitest).
 */
import { vi } from "vitest";

export const mockNavigate = vi.fn();
