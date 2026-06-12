import { Platform, useWindowDimensions } from "react-native";

/**
 * True when the iOS app is running as an iPad/iPhone app on Apple Silicon Mac
 * (Mac App Store / TestFlight "Designed for iPad" mode). Use to gate features
 * that don't work on Mac instead of opting out of Mac distribution entirely.
 */
export function isIOSAppOnMac(): boolean {
  if (Platform.OS !== "ios") return false;
  const constants = Platform.constants as {
    interfaceIdiom?: string;
    systemName?: string;
  };
  return constants.interfaceIdiom === "mac" || constants.systemName === "macOS";
}

/** Screens at/above this width are treated as tablet/iPad layout. */
export const TABLET_BREAKPOINT = 768;

/** Screens at/above this width are large tablets (12.9" iPad, landscape). */
export const LARGE_TABLET_BREAKPOINT = 1024;

/**
 * Tablet horizontal screen padding (the "gutter"). The layout is FLUID — there
 * is no fixed centered column; content fills the width minus this padding, and
 * grids reflow into as many columns as fit. Phone uses each screen's own
 * padding (gutter is only applied when `isTablet`).
 */
export const TABLET_GUTTER = 28;
export const LARGE_TABLET_GUTTER = 44;

/**
 * Live responsive layout info. Re-renders on rotation / split-view resize.
 *
 * Fluid model:
 * - `gutter` — horizontal screen padding to apply ON TABLET ONLY (0 on phone,
 *   meaning "keep the screen's existing padding").
 * - `fluidColumns(minItemWidth, phoneCols, available?)` — how many columns fill
 *   the available width with each cell at least `minItemWidth`. On phone it
 *   always returns `phoneCols` (so phone layout is unchanged).
 * - `gridColumns(phone, tablet, largeTablet?)` — fixed column count per
 *   breakpoint, for grids that should not grow unbounded.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isLargeTablet = width >= LARGE_TABLET_BREAKPOINT;
  const gutter = isLargeTablet
    ? LARGE_TABLET_GUTTER
    : isTablet
      ? TABLET_GUTTER
      : 0;

  function fluidColumns(
    minItemWidth: number,
    phoneCols: number,
    available?: number,
  ) {
    if (!isTablet) return phoneCols;
    const w = (available ?? width) - gutter * 2;
    return Math.max(phoneCols, Math.floor(w / minItemWidth));
  }

  function gridColumns(phone: number, tablet: number, largeTablet?: number) {
    if (!isTablet) return phone;
    if (isLargeTablet && typeof largeTablet === "number") return largeTablet;
    return tablet;
  }

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    isLandscape: width > height,
    gutter,
    fluidColumns,
    gridColumns,
  };
}

/**
 * Extra horizontal screen padding (the tablet "gutter") to ADD to a screen's
 * existing base padding. Returns 0 on phone, so callers can safely write
 * `paddingHorizontal: BASE + useScreenGutter()` and the iPhone layout stays
 * byte-for-byte identical (BASE + 0 === BASE).
 */
export function useScreenGutter(): number {
  const { isTablet, gutter } = useResponsive();
  return isTablet ? gutter : 0;
}

/**
 * flexBasis percentage string for a wrap-grid cell given a column count.
 * Slightly under the exact fraction so `gap` spacing doesn't force a reflow.
 */
export function gridFlexBasis(columns: number): `${number}%` {
  if (columns <= 1) return "100%";
  // leave ~3% total slack across the row for inter-item gaps
  const pct = Math.floor((100 / columns) * 100) / 100 - 3 / columns;
  return `${Math.max(1, pct)}%`;
}

/**
 * Pixel width for one cell of a fluid grid that exactly fills `available`
 * width with `columns` cells separated by `gap`.
 */
export function gridItemWidth(
  available: number,
  columns: number,
  gap: number,
): number {
  if (columns <= 1) return available;
  return (available - gap * (columns - 1)) / columns;
}
