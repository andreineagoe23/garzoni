import { getCurrentAppLanguage } from "./appLanguage";

/** App pricing and user-entered money default to GBP (UK market). */
export const DEFAULT_CURRENCY = "GBP";

/** Live stock/crypto quotes are sourced in USD (Yahoo / CoinGecko `vs_currencies=usd`). */
export const MARKET_QUOTE_CURRENCY = "USD";

export type FormatCurrencyOptions = Omit<
  Intl.NumberFormatOptions,
  "style" | "currency"
> & {
  /** ISO 4217 code; falls back to DEFAULT_CURRENCY when empty. */
  currency?: string | null;
  /** BCP 47 locale; defaults to the active app language. */
  locale?: string;
};

export function currencyLocale(
  language: string = getCurrentAppLanguage(),
): string {
  const lower = (language || "").toLowerCase();
  if (lower.startsWith("ro")) return "ro-RO";
  if (lower === "en") return "en-GB";
  return language || "en-GB";
}

export function resolveCurrency(currency?: string | null): string {
  const upper = (currency || "").trim().toUpperCase();
  const code = upper === "LEI" ? "RON" : upper;
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

/** Short symbol for labels and chart axes; falls back to the ISO code. */
export function currencySymbol(currency?: string | null): string {
  const code = resolveCurrency(currency);
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatCurrency(
  amount: number,
  options: FormatCurrencyOptions = {},
): string {
  const { currency, locale, ...numberOptions } = options;
  const code = resolveCurrency(currency);
  const { maximumFractionDigits: max, minimumFractionDigits: min } =
    numberOptions;
  if (max !== undefined && min === undefined && max < 2) {
    numberOptions.minimumFractionDigits = max;
  }
  const resolvedLocale = locale || currencyLocale();
  const base = { ...numberOptions, style: "currency" as const, currency: code };
  try {
    // narrowSymbol keeps "£" in ro-RO (which otherwise prints "GBP") and "$" in en-GB.
    return new Intl.NumberFormat(resolvedLocale, {
      currencyDisplay: "narrowSymbol",
      ...base,
    }).format(amount);
  } catch {
    // Older Hermes/ICU builds reject narrowSymbol.
    try {
      return new Intl.NumberFormat(resolvedLocale, base).format(amount);
    } catch {
      return `${code} ${amount.toFixed(max ?? 2)}`;
    }
  }
}
