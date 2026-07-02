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
import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";
import {
  shouldPromptReview,
  triggerHappyPathStoreReview,
  markReviewed,
} from "../reviewPrompt";

const store = (AsyncStorage as unknown as { __store: Record<string, string> })
  .__store;

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  jest.clearAllMocks();
  (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (StoreReview.hasAction as jest.Mock).mockResolvedValue(true);
});

describe("shouldPromptReview (gating)", () => {
  it("is true on the first positive event", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
  });

  it("does not depend on native StoreReview availability", async () => {
    // The modal's feedback path needs no native module; only the happy branch does.
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(false);
    expect(await shouldPromptReview("quiz_pass")).toBe(true);
  });

  it("is false a second time within the 30-day cooldown", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);

    expect(await shouldPromptReview("streak_milestone")).toBe(false);
    expect(await shouldPromptReview("streak_milestone")).toBe(false);
  });

  it("is true again once the 30-day cooldown has elapsed", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);

    const past = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store["garzoni:review_prompt_last_ts"] = String(past);

    expect(await shouldPromptReview("streak_milestone")).toBe(true);
  });

  it("stops after 3 prompts within a rolling 365 days", async () => {
    const past = () => String(Date.now() - 31 * 24 * 60 * 60 * 1000);
    // Three prompts are allowed (spacing past the 30-day cooldown each time).
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    store["garzoni:review_prompt_last_ts"] = past();
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    store["garzoni:review_prompt_last_ts"] = past();
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    // The 4th is blocked by the annual ceiling even though the cooldown elapsed.
    store["garzoni:review_prompt_last_ts"] = past();
    expect(await shouldPromptReview("lesson_complete")).toBe(false);
  });

  it("allows prompting again once old prompts age out of the 365-day window", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    // Simulate 3 prompts that all happened >1 year ago, plus an elapsed cooldown.
    const overAYearAgo = Date.now() - 366 * 24 * 60 * 60 * 1000;
    store["garzoni:review_prompt_timestamps"] = JSON.stringify([
      overAYearAgo,
      overAYearAgo,
      overAYearAgo,
    ]);
    store["garzoni:review_prompt_last_ts"] = String(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    );
    expect(await shouldPromptReview("streak_milestone")).toBe(true);
  });

  it("never prompts again once the user has left a review", async () => {
    await markReviewed();
    expect(await shouldPromptReview("lesson_complete")).toBe(false);

    // Even after the cooldown elapses.
    const past = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store["garzoni:review_prompt_last_ts"] = String(past);
    expect(await shouldPromptReview("streak_milestone")).toBe(false);
  });
});

describe("triggerHappyPathStoreReview", () => {
  const originalOS = Platform.OS;
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    openURL.mockRestore();
  });

  it("shows the native sheet on iOS", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    await triggerHappyPathStoreReview();
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("opens the Play Store listing on Android (no native card)", async () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    await triggerHappyPathStoreReview();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining("play.google.com/store/apps/details"),
    );
  });
});
