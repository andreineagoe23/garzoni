import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY,
  currencyLocale,
  currencySymbol,
  formatCurrency,
  resolveCurrency,
} from "./currency";

describe("formatCurrency", () => {
  it("defaults to GBP", () => {
    expect(DEFAULT_CURRENCY).toBe("GBP");
    expect(formatCurrency(1234.5, { locale: "en-GB" })).toBe("£1,234.50");
  });

  it("honours an explicit currency", () => {
    expect(formatCurrency(10, { currency: "USD", locale: "en-US" })).toBe(
      "$10.00",
    );
  });

  it("falls back to GBP for empty or invalid codes", () => {
    expect(resolveCurrency(null)).toBe("GBP");
    expect(resolveCurrency("")).toBe("GBP");
    expect(resolveCurrency("pounds")).toBe("GBP");
    expect(resolveCurrency("lei")).toBe("RON");
    expect(resolveCurrency("eur")).toBe("EUR");
  });

  it("supports whole-number output", () => {
    expect(
      formatCurrency(2000, { locale: "en-GB", maximumFractionDigits: 0 }),
    ).toBe("£2,000");
  });

  it("keeps the £ symbol in Romanian", () => {
    expect(
      formatCurrency(2000, { locale: "ro-RO", maximumFractionDigits: 0 }),
    ).toMatch(/^2\.000\s£$/);
  });

  it("maps app languages to currency locales", () => {
    expect(currencyLocale("en")).toBe("en-GB");
    expect(currencyLocale("ro")).toBe("ro-RO");
  });

  it("returns a short symbol for labels", () => {
    expect(currencySymbol()).toBe("£");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("RON")).toBe("RON");
  });
});
