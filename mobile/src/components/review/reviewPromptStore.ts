// Local UI-only store (modal visibility); shared domain stores live in @garzoni/core.
// eslint-disable-next-line no-restricted-imports
import { create } from "zustand";
import type { ReviewReason } from "../../bootstrap/reviewPrompt";

type ReviewPromptState = {
  visible: boolean;
  reason: ReviewReason | null;
  open: (reason: ReviewReason) => void;
  close: () => void;
};

/**
 * Drives the global {@link ReviewPromptModal}, mounted once at the app root.
 * Delight-event call sites open it via {@link maybeRequestReview} (which gates
 * first); the modal handles the sentiment branch from there.
 */
export const useReviewPromptStore = create<ReviewPromptState>((set) => ({
  visible: false,
  reason: null,
  open: (reason) => set({ visible: true, reason }),
  close: () => set({ visible: false, reason: null }),
}));
