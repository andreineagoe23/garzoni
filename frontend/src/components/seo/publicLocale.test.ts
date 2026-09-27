import { describe, expect, it } from "vitest";
import {
  hreflangAlternates,
  localizedPath,
  publicApiParams,
  publicLangFromPath,
} from "./publicLocale";

describe("publicLangFromPath", () => {
  it("reads Romanian only from the /ro prefix", () => {
    expect(publicLangFromPath("/ro/learn")).toBe("ro");
    expect(publicLangFromPath("/ro/guides/how-to-budget")).toBe("ro");
    expect(publicLangFromPath("/learn")).toBe("en");
    expect(publicLangFromPath("/roadmap")).toBe("en");
  });
});

describe("localizedPath", () => {
  it("prefixes Romanian paths and leaves English ones alone", () => {
    expect(localizedPath("/learn/x", "ro")).toBe("/ro/learn/x");
    expect(localizedPath("/learn/x", "en")).toBe("/learn/x");
  });
});

describe("hreflangAlternates", () => {
  it("emits en, ro and x-default when both versions exist", () => {
    expect(hreflangAlternates("/learn/x", ["en", "ro"])).toEqual([
      { hrefLang: "en", href: "https://www.garzoni.app/learn/x" },
      { hrefLang: "ro", href: "https://www.garzoni.app/ro/learn/x" },
      { hrefLang: "x-default", href: "https://www.garzoni.app/learn/x" },
    ]);
  });

  it("emits nothing when the other language does not exist", () => {
    expect(hreflangAlternates("/learn/x", ["en"])).toBeUndefined();
    expect(hreflangAlternates("/learn/x", undefined)).toBeUndefined();
  });
});

describe("publicApiParams", () => {
  it("adds ?lang only for Romanian so English API URLs stay unchanged", () => {
    expect(publicApiParams("ro")).toEqual({ lang: "ro" });
    expect(publicApiParams("en")).toBeUndefined();
  });
});
