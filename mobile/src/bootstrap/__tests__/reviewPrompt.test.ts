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

jest.mock("../customerIoMobile", () => ({
  trackGarzoniEvent: jest.fn(() => Promise.resolve()),
}));

/* eslint-disable import/first -- mocks must run before importing the module under test */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";
import { trackGarzoniEvent } from "../customerIoMobile";
import {
  shouldPromptReview,
  markReviewed,
  maybeRequestReview,
  openStoreReview,
} from "../reviewPrompt";

const store = (AsyncStorage as unknown as { __store: Record<string, string> })
  .__store;

const DAY_MS = 24 * 60 * 60 * 1000;
const elapseCooldown = () => {
  store["garzoni:review_prompt_last_ts"] = String(Date.now() - 31 * DAY_MS);
};

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

  it("is false a second time within the 30-day cooldown", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);

    expect(await shouldPromptReview("streak_milestone")).toBe(false);
    expect(await shouldPromptReview("streak_milestone")).toBe(false);
  });

  it("is true again once the 30-day cooldown has elapsed", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    elapseCooldown();
    expect(await shouldPromptReview("streak_milestone")).toBe(true);
  });

  it("stops after 3 prompts within a rolling 365 days", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    elapseCooldown();
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    elapseCooldown();
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    // The 4th is blocked by the annual ceiling even though the cooldown elapsed.
    elapseCooldown();
    expect(await shouldPromptReview("lesson_complete")).toBe(false);
  });

  it("allows prompting again once old prompts age out of the 365-day window", async () => {
    expect(await shouldPromptReview("lesson_complete")).toBe(true);
    const overAYearAgo = Date.now() - 366 * DAY_MS;
    store["garzoni:review_prompt_timestamps"] = JSON.stringify([
      overAYearAgo,
      overAYearAgo,
      overAYearAgo,
    ]);
    elapseCooldown();
    expect(await shouldPromptReview("streak_milestone")).toBe(true);
  });

  it("never prompts again once the user has been routed to the store", async () => {
    await markReviewed();
    expect(await shouldPromptReview("lesson_complete")).toBe(false);
    elapseCooldown();
    expect(await shouldPromptReview("streak_milestone")).toBe(false);
  });
});

describe("maybeRequestReview (delight-moment entry point)", () => {
  const originalOS = Platform.OS;
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    openURL.mockRestore();
  });

  it.each(["android", "ios"])(
    "shows the native review sheet after the first positive event on %s",
    async (os) => {
      Object.defineProperty(Platform, "OS", { value: os });
      await maybeRequestReview("lesson_complete");
      expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
      expect(trackGarzoniEvent).toHaveBeenCalledWith("app_review_requested", {
        reason: "lesson_complete",
      });
      expect(openURL).not.toHaveBeenCalled();
    },
  );

  it("never asks a question before the native sheet", async () => {
    // Play policy: no "do you like the app?" step may precede the review card.
    expect(() =>
      jest.requireActual("../../components/review/ReviewPromptModal"),
    ).toThrow();
    expect(() =>
      jest.requireActual("../../components/review/reviewPromptStore"),
    ).toThrow();

    await maybeRequestReview("quiz_pass");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("respects the 30-day cooldown", async () => {
    await maybeRequestReview("lesson_complete");
    jest.clearAllMocks();
    await maybeRequestReview("quiz_pass");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(trackGarzoniEvent).not.toHaveBeenCalled();
  });

  it("respects the yearly cap", async () => {
    for (let i = 0; i < 3; i += 1) {
      await maybeRequestReview("lesson_complete");
      elapseCooldown();
    }
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(3);
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(3);
  });

  it("does nothing when the native review is unavailable", async () => {
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(trackGarzoniEvent).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
    // The gate isn't consumed, so the next delight moment can still ask.
    expect(store["garzoni:review_prompt_last_ts"]).toBeUndefined();
  });

  it("does nothing when the OS has no review action", async () => {
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(false);
    await maybeRequestReview("streak_milestone");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe("openStoreReview (manual Settings action)", () => {
  const originalOS = Platform.OS;
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    openURL.mockRestore();
  });

  it("uses the native sheet when available, bypassing the gate", async () => {
    await maybeRequestReview("lesson_complete");
    jest.clearAllMocks();
    await openStoreReview();
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("falls back to the store listing when native review is unavailable", async () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    (StoreReview.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await openStoreReview();
    expect(openURL).toHaveBeenCalledWith(
      expect.stringContaining("play.google.com/store/apps/details"),
    );
  });

  it("stops future automatic prompts", async () => {
    await openStoreReview();
    jest.clearAllMocks();
    await maybeRequestReview("lesson_complete");
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
