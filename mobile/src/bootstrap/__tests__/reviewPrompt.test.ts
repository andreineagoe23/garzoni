jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __store: store,
    getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      store[k] = v;
      return Promise.resolve();
    }),
  };
});

jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  hasAction: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
}));

/* eslint-disable import/first -- mocks must run before importing the module under test */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { maybeRequestReview } from "../reviewPrompt";

const store = (AsyncStorage as unknown as { __store: Record<string, string> })
  .__store;

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  jest.clearAllMocks();
  (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (StoreReview.hasAction as jest.Mock).mockResolvedValue(true);
});

describe("maybeRequestReview", () => {
  it("does not prompt before 3 positive events, then prompts on the 3rd", async () => {
    await maybeRequestReview("lesson_complete");
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("does nothing when StoreReview is unavailable", async () => {
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await maybeRequestReview("quiz_pass");
    await maybeRequestReview("quiz_pass");
    await maybeRequestReview("quiz_pass");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it("does nothing when no review action is available", async () => {
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(false);
    await maybeRequestReview("streak_milestone");
    await maybeRequestReview("streak_milestone");
    await maybeRequestReview("streak_milestone");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it("does not prompt twice within the 120-day cooldown", async () => {
    // Reach the threshold and fire once.
    await maybeRequestReview("lesson_complete");
    await maybeRequestReview("lesson_complete");
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);

    // Further positive events stay inside the cooldown window.
    await maybeRequestReview("streak_milestone");
    await maybeRequestReview("streak_milestone");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("prompts again once the cooldown has elapsed", async () => {
    await maybeRequestReview("lesson_complete");
    await maybeRequestReview("lesson_complete");
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);

    // Simulate the last prompt happening 121 days ago.
    const past = Date.now() - 121 * 24 * 60 * 60 * 1000;
    store["garzoni:review_prompt_last_ts"] = String(past);

    await maybeRequestReview("streak_milestone");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(2);
  });
});
