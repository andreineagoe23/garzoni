/**
 * Tests for locale-aware formatting utilities
 */
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDate,
  formatTime,
  getLocale,
  getTimezone,
} from "./format";

describe("format utilities", () => {
  describe("formatNumber", () => {
    it("formats numbers in en-US locale", () => {
      expect(formatNumber(1234.56, "en-US")).toBe("1,234.56");
      expect(formatNumber(1000000, "en-US")).toBe("1,000,000");
    });

    it("formats numbers in es-ES locale", () => {
      const result1 = formatNumber(1234.56, "es-ES");
      // May or may not include thousand separator for small numbers
      expect(result1).toMatch(/1234[.,]56|1[.,]234[.,]56/);
      const result2 = formatNumber(1000000, "es-ES");
      // Large numbers should have separators
      expect(result2).toMatch(/1[.,]000[.,]000/);
    });

    it("handles custom options", () => {
      expect(formatNumber(1234.56, "en-US", { maximumFractionDigits: 0 })).toBe("1,235");
    });

    it("handles invalid values gracefully", () => {
      expect(formatNumber(NaN, "en-US")).toBe("NaN");
    });
  });

  describe("formatCurrency", () => {
    it("formats USD in en-US locale", () => {
      expect(formatCurrency(1234.56, "USD", "en-US")).toMatch(/\$1,234\.56|1,234\.56\s*USD/);
    });

    it("formats EUR in es-ES locale", () => {
      const result = formatCurrency(1234.56, "EUR", "es-ES");
      // May or may not include thousand separator
      expect(result).toMatch(/1234[.,]56|1[.,]234[.,]56/);
      expect(result).toMatch(/EUR|€/);
    });

    it("handles custom options", () => {
      const result = formatCurrency(1234.56, "USD", "en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      expect(result).toMatch(/\$1,235|1,235\s*USD/);
    });
  });

  describe("formatPercentage", () => {
    it("formats percentages", () => {
      expect(formatPercentage(50, "en-US")).toBe("50%");
      expect(formatPercentage(12.5, "en-US", 1)).toBe("12.5%");
    });

    it("handles different locales", () => {
      const result = formatPercentage(50, "es-ES");
      expect(result).toMatch(/50%|50\s*%/);
    });
  });

  describe("formatDate", () => {
    it("formats dates in en-US locale", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "en-US");
      expect(result).toMatch(/Jan|January/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it("formats dates in es-ES locale", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "es-ES");
      expect(result).toMatch(/ene|enero/i);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it("handles string dates", () => {
      const result = formatDate("2024-01-15", "en-US");
      expect(result).toBeTruthy();
    });

    it("handles null/undefined", () => {
      expect(formatDate(null, "en-US")).toBe("");
      expect(formatDate(undefined, "en-US")).toBe("");
    });

    it("handles custom options", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date, "en-US", { year: "numeric", month: "long" });
      expect(result).toMatch(/January|2024/);
    });
  });

  describe("formatTime", () => {
    it("formats time in 12-hour format", () => {
      const date = new Date("2024-01-15T14:30:00");
      const result = formatTime(date, "en-US");
      expect(result).toMatch(/2:30|14:30/);
    });

    it("handles null/undefined", () => {
      expect(formatTime(null, "en-US")).toBe("");
      expect(formatTime(undefined, "en-US")).toBe("");
    });
  });

  describe("getLocale", () => {
    it("returns normalized locale from i18n", () => {
      const locale = getLocale();
      expect(locale).toMatch(/^(en-US|es-ES)$/);
    });
  });

  describe("getTimezone", () => {
    it("returns a timezone string", () => {
      const tz = getTimezone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});
