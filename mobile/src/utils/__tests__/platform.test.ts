import { Platform } from "react-native";
import { isIOSAppOnMac } from "../platform";

describe("isIOSAppOnMac", () => {
  const originalOS = Platform.OS;
  const originalConstants = Platform.constants;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
    Object.defineProperty(Platform, "constants", { value: originalConstants });
  });

  it("returns false on Android", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    expect(isIOSAppOnMac()).toBe(false);
  });

  it("returns false on iPhone", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    Object.defineProperty(Platform, "constants", {
      value: { interfaceIdiom: "phone", systemName: "iOS" },
    });
    expect(isIOSAppOnMac()).toBe(false);
  });

  it("returns true when interfaceIdiom is mac", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    Object.defineProperty(Platform, "constants", {
      value: { interfaceIdiom: "mac", systemName: "iOS" },
    });
    expect(isIOSAppOnMac()).toBe(true);
  });

  it("returns true when systemName is macOS", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    Object.defineProperty(Platform, "constants", {
      value: { interfaceIdiom: "pad", systemName: "macOS" },
    });
    expect(isIOSAppOnMac()).toBe(true);
  });
});
