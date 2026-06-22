import { useEffect, useState } from "react";

export type ChartPalette = {
  brand: string;
  brandSoft: string;
  info: string;
  warning: string;
  accent: string;
  error: string;
};

const FALLBACK: ChartPalette = {
  brand: "var(--color-brand-primary)",
  brandSoft: "var(--color-brand-primary-hover)",
  info: "var(--color-state-info)",
  warning: "var(--color-state-warning)",
  accent: "var(--color-accent)",
  error: "var(--color-state-error)",
};

function readCssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function readPalette(): ChartPalette {
  return {
    brand: readCssVar("--color-brand-primary", "#1d5330"),
    brandSoft: readCssVar("--color-brand-primary-hover", "#2a7347"),
    info: readCssVar("--color-state-info", "#0284c7"),
    warning: readCssVar("--color-state-warning", "#d97706"),
    accent: readCssVar("--color-accent", "#e6c87a"),
    error: readCssVar("--color-state-error", "#dc2626"),
  };
}

/** Recharts needs resolved colors; reads semantic tokens and refreshes on theme change. */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(() => readPalette());

  useEffect(() => {
    const refresh = () => setPalette(readPalette());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}

export { FALLBACK as chartPaletteFallback };
