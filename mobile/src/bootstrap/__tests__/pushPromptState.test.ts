jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __store: store,
    __fail: { get: false, set: false },
    getItem: jest.fn(function (this: void, k: string) {
      const mod = jest.requireMock("@react-native-async-storage/async-storage");
      if (mod.__fail.get) return Promise.reject(new Error("storage down"));
      return Promise.resolve(store[k] ?? null);
    }),
    setItem: jest.fn(function (this: void, k: string, v: string) {
      const mod = jest.requireMock("@react-native-async-storage/async-storage");
      if (mod.__fail.set) return Promise.reject(new Error("storage down"));
      store[k] = v;
      return Promise.resolve();
    }),
  };
});

/* eslint-disable import/first -- the mock must run before the module under test */
import {
  hasAskedForPush,
  isPushPromptDue,
  markPushPromptDue,
} from "../pushPromptState";

const storage = jest.requireMock(
  "@react-native-async-storage/async-storage",
) as {
  __store: Record<string, string>;
  __fail: { get: boolean; set: boolean };
};

describe("push prompt gating", () => {
  beforeEach(() => {
    for (const k of Object.keys(storage.__store)) delete storage.__store[k];
    storage.__fail.get = false;
    storage.__fail.set = false;
  });

  it("is not due before any lesson has been completed", async () => {
    // The whole point: onboarding must not be able to spend the one-shot dialog.
    await expect(isPushPromptDue()).resolves.toBe(false);
  });

  it("becomes due once a lesson is completed", async () => {
    await markPushPromptDue();
    await expect(isPushPromptDue()).resolves.toBe(true);
  });

  it("stays due across repeat completions", async () => {
    await markPushPromptDue();
    await markPushPromptDue();
    await expect(isPushPromptDue()).resolves.toBe(true);
  });

  it("tracks due separately from asked", async () => {
    await markPushPromptDue();
    await expect(hasAskedForPush()).resolves.toBe(false);
  });

  it("fails closed when storage is unreadable, rather than prompting a stranger", async () => {
    await markPushPromptDue();
    storage.__fail.get = true;
    await expect(isPushPromptDue()).resolves.toBe(false);
  });

  it("treats an unreadable store as already asked, so it cannot loop", async () => {
    storage.__fail.get = true;
    await expect(hasAskedForPush()).resolves.toBe(true);
  });

  it("does not throw when the store rejects a write", async () => {
    storage.__fail.set = true;
    await expect(markPushPromptDue()).resolves.toBeUndefined();
  });
});
