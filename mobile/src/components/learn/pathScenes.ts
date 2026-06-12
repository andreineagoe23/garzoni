import type { MascotType } from "@garzoni/core";
import { hash01 } from "../journey/journeyLayout";

/**
 * Scene recipes for All Topics path cards — each card header is a tiny
 * composed landscape built from the journey sprite kit instead of an
 * AI-generated cover image. Recipes are static data: deterministic,
 * theme-aware, keyed by the same title keywords the old covers used.
 */

export type SceneSpriteKind =
  | "tree"
  | "treeCluster"
  | "peak"
  | "cloud"
  | "grass"
  | "summit"
  | "campsite"
  | "chest"
  | "mascot";

export type SceneSprite = {
  kind: SceneSpriteKind;
  /** 0..1 horizontal anchor (sprite center) across the header width. */
  x: number;
  /** px — height for trees/grass/summit/chest/mascot, width for peak/cloud/campsite. */
  size: number;
  variant?: number;
  snow?: boolean;
  mascot?: MascotType;
  flip?: boolean;
  opacity?: number;
  /** px raised above the ground line (clouds float at 40–60). */
  lift?: number;
};

export type SceneRecipe = {
  key: string;
  /** Vertical gradient stops, top → horizon. */
  sky: { light: [string, string]; dark: [string, string] };
  ground: { light: string; dark: string };
  /** Painter order: index 0 draws first (back). */
  sprites: SceneSprite[];
};

/** Night-market violet — treasure chest centerpiece. */
const CRYPTO: SceneRecipe = {
  key: "crypto",
  sky: { light: ["#7c8bdb", "#c3b8ef"], dark: ["#1d2350", "#3a3270"] },
  ground: { light: "#5e6fae", dark: "#252b55" },
  sprites: [
    { kind: "cloud", x: 0.78, size: 70, lift: 52, opacity: 0.85 },
    { kind: "tree", x: 0.1, size: 56, variant: 3 },
    { kind: "chest", x: 0.48, size: 46 },
    { kind: "tree", x: 0.88, size: 50, variant: 1, flip: true },
    { kind: "grass", x: 0.3, size: 14 },
  ],
};

/** Cold dawn over peaks — the markets bull on a snowfield. */
const FOREX: SceneRecipe = {
  key: "forex",
  sky: { light: ["#a8d4e8", "#e3f2f8"], dark: ["#16324a", "#2b4d68"] },
  ground: { light: "#dfe9f2", dark: "#33455e" },
  sprites: [
    { kind: "peak", x: 0.22, size: 96, variant: 0, opacity: 0.9 },
    { kind: "peak", x: 0.72, size: 110, variant: 1 },
    { kind: "cloud", x: 0.5, size: 64, lift: 58, opacity: 0.8 },
    { kind: "tree", x: 0.08, size: 52, variant: 0, snow: true },
    { kind: "tree", x: 0.92, size: 46, variant: 2, snow: true, flip: true },
    { kind: "mascot", x: 0.46, size: 44, mascot: "bull" },
  ],
};

/** Sunrise calm — the wise owl at first light. */
const MINDSET: SceneRecipe = {
  key: "mindset",
  sky: { light: ["#fcd9a8", "#fdeeda"], dark: ["#4a2e4e", "#7a4a52"] },
  ground: { light: "#a9cb8b", dark: "#2a4631" },
  sprites: [
    { kind: "cloud", x: 0.2, size: 60, lift: 50, opacity: 0.75 },
    { kind: "tree", x: 0.82, size: 64, variant: 3 },
    { kind: "grass", x: 0.35, size: 14 },
    { kind: "grass", x: 0.55, size: 14 },
    { kind: "mascot", x: 0.16, size: 42, mascot: "owl" },
  ],
};

/** Green homestead — campsite centerpiece (the "property"). */
const REAL_ESTATE: SceneRecipe = {
  key: "realEstate",
  sky: { light: ["#9fd0ea", "#dff0f7"], dark: ["#1c3a52", "#2f5a70"] },
  ground: { light: "#9fca82", dark: "#22402c" },
  sprites: [
    { kind: "tree", x: 0.1, size: 58, variant: 1 },
    { kind: "campsite", x: 0.52, size: 92 },
    { kind: "tree", x: 0.9, size: 50, variant: 1, flip: true },
    { kind: "grass", x: 0.28, size: 14 },
    { kind: "grass", x: 0.72, size: 14 },
  ],
};

/** Fresh mint morning — the bear guarding a small chest. */
const PERSONAL_FINANCE: SceneRecipe = {
  key: "personalFinance",
  sky: { light: ["#8fd6c2", "#e2f5ec"], dark: ["#14403a", "#1f5a4c"] },
  ground: { light: "#8cc375", dark: "#1f3c28" },
  sprites: [
    { kind: "tree", x: 0.12, size: 60, variant: 0 },
    { kind: "chest", x: 0.7, size: 36 },
    { kind: "grass", x: 0.45, size: 14 },
    { kind: "mascot", x: 0.3, size: 44, mascot: "bear" },
    { kind: "cloud", x: 0.85, size: 56, lift: 54, opacity: 0.8 },
  ],
};

/** The classic climb — summit centerpiece (basic finance + unknown paths). */
const DEFAULT_SCENE: SceneRecipe = {
  key: "default",
  sky: { light: ["#8fbfe8", "#dcebf7"], dark: ["#16283f", "#2a4159"] },
  ground: { light: "#9fca82", dark: "#22402c" },
  sprites: [
    { kind: "cloud", x: 0.18, size: 62, lift: 56, opacity: 0.8 },
    { kind: "summit", x: 0.5, size: 86 },
    { kind: "tree", x: 0.08, size: 52, variant: 0 },
    { kind: "tree", x: 0.92, size: 46, variant: 2, flip: true },
    { kind: "grass", x: 0.68, size: 14 },
  ],
};

/** Same keyword chain as the old coverForPath(). */
export function sceneForPath(title: string, pathId?: number): SceneRecipe {
  const t = title.toLowerCase();
  if (t.includes("crypto")) return CRYPTO;
  if (t.includes("forex") || t.includes("fx")) return FOREX;
  if (t.includes("mindset")) return MINDSET;
  if (t.includes("real estate") || t.includes("property")) return REAL_ESTATE;
  if (t.includes("personal")) return PERSONAL_FINANCE;
  // Unknown paths share the default scene but jitter tree variants so two
  // unknown paths still read slightly different — stable across renders.
  const jitter = Math.floor(hash01(pathId ?? 0) * 4);
  return {
    ...DEFAULT_SCENE,
    sprites: DEFAULT_SCENE.sprites.map((s) =>
      s.kind === "tree" ? { ...s, variant: (s.variant ?? 0) + jitter } : s,
    ),
  };
}
