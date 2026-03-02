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

export const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};
