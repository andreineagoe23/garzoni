import { formatCurrency, getLocale } from "utils/format";

/**
 * Pounds, as the landing page quotes every figure in GBP. narrowSymbol keeps "£"
 * in Romanian too (ro-RO would otherwise print "GBP", unlike the copy around it).
 */
export const money = (value: number, fractionDigits = 0, currency = "GBP") =>
  formatCurrency(value, currency, getLocale(), {
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

export const decimal = (value: number, fractionDigits = 1) =>
  new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

export const percent = (value: number) =>
  `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(value)}%`;

/** 106 → "106", 12 400 → "12.4K+". Exact until the count is too long to read at a glance. */
export const compactCount = (value: number) =>
  value < 1000
    ? new Intl.NumberFormat(getLocale()).format(value)
    : `${new Intl.NumberFormat(getLocale(), {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)}+`;
