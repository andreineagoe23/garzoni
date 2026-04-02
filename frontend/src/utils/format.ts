/**
 * Format utilities for locale-aware number, date, and percentage formatting
 */

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "constants/i18n";

type LocaleLike = string | undefined;

const normalizeLocale = (locale: LocaleLike) => {
  if (!locale) return "en-US";
  const lower = locale.toLowerCase();
  if (lower.startsWith("ro")) return "ro-RO";
  if (lower.startsWith("es")) return "es-ES";
  if (lower.startsWith("en")) return "en-US";
  return locale;
};

export const getLocale = () => {
  try {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored) return normalizeLocale(stored);
    }
  } catch {
    // Ignore storage access errors
  }

  try {
    return normalizeLocale(navigator.language);
  } catch {
    return normalizeLocale(DEFAULT_LANGUAGE);
  }
};

export const formatNumber = (
  value: number,
  locale: LocaleLike = getLocale(),
  options: Intl.NumberFormatOptions = {}
) => {
  try {
    return new Intl.NumberFormat(normalizeLocale(locale), options).format(
      value
    );
  } catch {
    return String(value);
  }
};

export const formatCurrency = (
  value: number,
  currency: string,
  locale: LocaleLike = getLocale(),
  options: Intl.NumberFormatOptions = {}
) => {
  try {
    return new Intl.NumberFormat(normalizeLocale(locale), {
      style: "currency",
      currency,
      ...options,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
};

export const formatPercentage = (
  value: number,
  locale: LocaleLike = getLocale(),
  decimals = 0
) => {
  try {
    return new Intl.NumberFormat(normalizeLocale(locale), {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100);
  } catch {
    return `${value.toFixed(decimals)}%`;
  }
};

export const formatDate = (
  date: Date | string | number | null | undefined,
  locale: LocaleLike = getLocale(),
  options: Intl.DateTimeFormatOptions = {}
) => {
  try {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(normalizeLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    }).format(dateObj);
  } catch {
    return String(date ?? "");
  }
};

export const formatTime = (
  date: Date | string | number | null | undefined,
  locale: LocaleLike = getLocale()
) => {
  try {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(normalizeLocale(locale), {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj);
  } catch {
    return String(date ?? "");
  }
};

/**
 * Compact relative date + time for recent activity: "Today, 9:37 PM", "Yesterday, 2:30 PM", "12 Mar", etc.
 */
export const formatRelativeDateTime = (
  date: Date | string | number | null | undefined,
  locale: LocaleLike = getLocale()
): string => {
  try {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const n = normalizeLocale(locale);
    const timeStr = new Intl.DateTimeFormat(n, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfDate = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate()
    );
    const diffDays = Math.round(
      (startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 0) {
      const rtf = new Intl.RelativeTimeFormat(n, { numeric: "auto" });
      return `${rtf.format(0, "day")}, ${timeStr}`;
    }
    if (diffDays === 1) {
      const rtf = new Intl.RelativeTimeFormat(n, { numeric: "auto" });
      return `${rtf.format(-1, "day")}, ${timeStr}`;
    }
    if (diffDays > 1 && diffDays <= 7) {
      return new Intl.DateTimeFormat(n, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(dateObj);
    }
    if (dateObj.getFullYear() === now.getFullYear()) {
      return new Intl.DateTimeFormat(n, {
        month: "short",
        day: "numeric",
      }).format(dateObj);
    }
    return new Intl.DateTimeFormat(n, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  } catch {
    return typeof date === "string" || typeof date === "number"
      ? String(date)
      : "";
  }
};

export const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

/** Strip (Starter), (Plus), (Pro) from path titles for display on dashboard. */
export const pathDisplayTitle = (title: string | undefined | null): string => {
  if (!title || typeof title !== "string") return "";
  return title.replace(/\s*\((?:Starter|Plus|Pro)\)\s*$/i, "").trim();
};
