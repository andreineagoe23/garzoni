/**
 * Format utilities for locale-aware number, date, and percentage formatting
 */

export const formatNumber = (value, locale = "en-US", options = {}) => {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch (error) {
    return String(value);
  }
};

export const formatPercentage = (value, locale = "en-US", decimals = 0) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100);
  } catch (error) {
    return `${value.toFixed(decimals)}%`;
  }
};

export const formatDate = (date, locale = "en-US", options = {}) => {
  try {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    }).format(dateObj);
  } catch (error) {
    return String(date);
  }
};

export const formatTime = (date, locale = "en-US") => {
  try {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj);
  } catch (error) {
    return String(date);
  }
};

export const getTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return "UTC";
  }
};

export const getLocale = () => {
  try {
    return navigator.language || "en-US";
  } catch (error) {
    return "en-US";
  }
};
