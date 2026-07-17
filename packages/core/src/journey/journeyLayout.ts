import { getCourseMetrics } from "../lib/personalizedPath";
import type {
  PersonalizedPathCourseProgress,
  PersonalizedPathMetrics,
} from "../lib/personalizedPath";
import type { PersonalizedPathCourse } from "../types/api";

/**
 * Pure layout math for the personalized-path journey map.
 * Coordinates are in "map space": y grows downward, summit at top,
 * basecamp (course 0) at the bottom — the learner climbs upward.
 */

export type JourneyNodeState =
  | "done"
  | "current"
  | "next"
  | "upcoming"
  /** Requires a higher plan — shown ghosted under the fog. */
  | "locked";

export type JourneyNodeModel = {
  course: PersonalizedPathCourse;
  metrics: PersonalizedPathMetrics;
  state: JourneyNodeState;
  /** Node center in map coordinates. */
  x: number;
  y: number;
};

export type JourneyChestModel = {
  x: number;
  y: number;
  /** Every node below the chest is complete. */
  unlocked: boolean;
  /** The climber has reached the tile just below the chest (fade it in). */
  reached: boolean;
};

export type JourneyDecorationKind =
  "tree" | "trees" | "peak" | "cloud" | "grass" | "rock";

export type JourneyDecorationModel = {
  /** Ground anchor: x is the sprite's center, y is where its FEET sit. */
  x: number;
  y: number;
  kind: JourneyDecorationKind;
  /** Tree/grass height; peak & cloud width, px. */
  size: number;
  /** Snowy variant near the summit. */
  snow: boolean;
  /** Picks between sprite variations of the same kind. */
  variant: number;
  opacity: number;
};

export type JourneyTrailModel = {
  /** Full SVG path from basecamp to summit. */
  d: string;
  /** Approximate length of the full path. */
  totalLength: number;
  /** Length of the climbed (completed) portion, from basecamp. */
  progressLength: number;
  /** Map-space point sitting at `progressLength` along the path. */
  progressTip: { x: number; y: number } | null;
};

export type JourneyLayout = {
  /** Journey order: index 0 = basecamp (bottom of map). */
  nodes: JourneyNodeModel[];
  /** Milestone chests sitting beside the trail. */
  chests: JourneyChestModel[];
  /** The winding trail connecting basecamp → nodes → summit. */
  trail: JourneyTrailModel;
  /** Mountain scenery scattered beside the trail. */
  decorations: JourneyDecorationModel[];
  width: number;
  height: number;
  /** Index into `nodes` of the current node, -1 when none (all done/locked). */
  currentIndex: number;
  /** Map-space y where the fog of war ends (0 = no fog). Fog covers y < fogBottomY. */
  fogBottomY: number;
  /** Trail endpoint — the tip of the summit mountain. */
  summit: { x: number; y: number };
  /**
   * The summit mountain as a BACKGROUND object: its base sits where the
   * gravel band ends and it fills the snow band; the trail winds across its
   * face up to the tip. x is center, y is the base (feet), height in px.
   */
  summitSprite: { x: number; y: number; height: number };
  basecamp: { x: number; y: number };
};

export const NODE_SPACING = 104;
/** Room above the top node: summit sprite + label must clear the floating header. */
/** Sky above the summit — also clears the floating climb header. */
export const TOP_PAD = 360;
/** Room below the lowest node: campsite sprite + label + meadow before the map ends. */
export const BOTTOM_PAD = 260;

/** Smooth left/right wave, Duolingo-style. */
const WAVE = [0, 0.62, 1, 0.62, 0, -0.62, -1, -0.62];

export function nodeStateFor(
  course: PersonalizedPathCourse,
  metrics: PersonalizedPathMetrics,
  index: number,
  currentIndex: number,
): JourneyNodeState {
  if (course.locked) return "locked";
  // Single section-based completion check (see @garzoni/core computeCourseProgress).
  if (metrics.isComplete || metrics.percent >= 100) return "done";
  if (index === currentIndex) return "current";
  if (currentIndex >= 0 && index === currentIndex + 1) return "next";
  return "upcoming";
}

type Pt = { x: number; y: number };

/** Cubic bezier point at t. */
function cubicAt(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

const TRAIL_SAMPLES_PER_SEGMENT = 20;

/**
 * Smooth Catmull-Rom spline through the travel points
 * (basecamp → each node → summit) converted to cubic beziers, plus an
 * arc-length table so progress can be expressed as a stroke length.
 */
function buildTrail(
  nodes: JourneyNodeModel[],
  basecamp: Pt,
  summit: Pt,
  currentIndex: number,
): JourneyTrailModel {
  const pts: Pt[] = [
    basecamp,
    ...nodes.map((nd) => ({ x: nd.x, y: nd.y })),
    summit,
  ];
  if (pts.length < 2) {
    return { d: "", totalLength: 0, progressLength: 0, progressTip: null };
  }

  // Catmull-Rom control points, endpoints clamped.
  const segs: { p0: Pt; c1: Pt; c2: Pt; p1: Pt }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const prev = pts[i - 1] ?? pts[i];
    const next = pts[i + 2] ?? pts[i + 1];
    segs.push({
      p0: pts[i],
      c1: {
        x: pts[i].x + (pts[i + 1].x - prev.x) / 6,
        y: pts[i].y + (pts[i + 1].y - prev.y) / 6,
      },
      c2: {
        x: pts[i + 1].x - (next.x - pts[i].x) / 6,
        y: pts[i + 1].y - (next.y - pts[i].y) / 6,
      },
      p1: pts[i + 1],
    });
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (const s of segs) {
    d += ` C ${s.c1.x.toFixed(1)} ${s.c1.y.toFixed(1)}, ${s.c2.x.toFixed(1)} ${s.c2.y.toFixed(1)}, ${s.p1.x.toFixed(1)} ${s.p1.y.toFixed(1)}`;
  }

  // Arc-length table: sampled points + cumulative length at every travel point.
  const samples: { pt: Pt; len: number }[] = [{ pt: pts[0], len: 0 }];
  const lenAtPoint: number[] = [0];
  let total = 0;
  for (const s of segs) {
    let prev = s.p0;
    for (let k = 1; k <= TRAIL_SAMPLES_PER_SEGMENT; k++) {
      const pt = cubicAt(s.p0, s.c1, s.c2, s.p1, k / TRAIL_SAMPLES_PER_SEGMENT);
      total += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      samples.push({ pt, len: total });
      prev = pt;
    }
    lenAtPoint.push(total);
  }

  // Climbed distance: basecamp → current node, plus partial credit toward
  // the next node from in-progress sections. Travel point of node i = i + 1.
  let progressLength = 0;
  if (currentIndex >= 0) {
    const node = nodes[currentIndex];
    const reached = currentIndex + 1;
    const segLen = (lenAtPoint[reached + 1] ?? total) - lenAtPoint[reached];
    const partial = Math.max(0, Math.min(1, node.metrics.percent / 100));
    progressLength = lenAtPoint[reached] + partial * segLen;
  } else {
    // No current node: color through the last consecutively completed node.
    let doneCount = 0;
    while (doneCount < nodes.length && nodes[doneCount].state === "done") {
      doneCount++;
    }
    progressLength =
      doneCount === nodes.length ? total : (lenAtPoint[doneCount] ?? 0);
  }

  let progressTip: Pt | null = null;
  if (progressLength > 0) {
    const idx = samples.findIndex((s) => s.len >= progressLength);
    progressTip = (samples[idx === -1 ? samples.length - 1 : idx] ?? samples[0])
      .pt;
  }

  return { d, totalLength: total, progressLength, progressTip };
}

/** Deterministic pseudo-random in [0, 1) so the scenery doesn't reshuffle. */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Composed scenery, biome-correct. Every decoration is picked by the altitude
 * band its FEET land in, matching the terrain JourneyBackdrop paints:
 *   meadow <0.3  — round leafy trees + grass, scattered across the field
 *   forest <0.62 — pine trees, denser
 *   rock  <0.85  — gravel: boulders/pebbles only (no trees, no mountains)
 *   snow  ≥0.85  — snow pines, clouds, one distant peak on the left
 * Everything keeps clear of the trail and is painter-sorted (higher up draws
 * first). Deterministic via hash01 — never reshuffles between renders.
 */
function buildDecorations(
  nodes: JourneyNodeModel[],
  width: number,
  cx: number,
  amplitude: number,
  chests: JourneyChestModel[],
): JourneyDecorationModel[] {
  const out: JourneyDecorationModel[] = [];
  const n = nodes.length;
  if (n < 2) return out;

  const bottomY = nodes[0].y;
  const topY = nodes[n - 1].y;
  const elevAt = (y: number) => (bottomY - y) / Math.max(bottomY - topY, 1);
  const yAt = (elevation: number) => bottomY - elevation * (bottomY - topY);

  // Approximate trail x at a given y: linear walk between node centers.
  const trailXAt = (y: number): number => {
    if (y >= nodes[0].y) return nodes[0].x;
    if (y <= nodes[n - 1].y) return nodes[n - 1].x;
    for (let i = 0; i < n - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      if (y <= a.y && y >= b.y) {
        const t = (a.y - y) / Math.max(a.y - b.y, 1);
        return a.x + (b.x - a.x) * t;
      }
    }
    return cx;
  };

  // Push a candidate x sideways until it's clear of the trail at that y.
  const clearOfTrail = (x: number, y: number, min = 64): number => {
    const tx = trailXAt(y);
    if (Math.abs(x - tx) >= min) return Math.min(Math.max(x, 24), width - 24);
    const side = x >= tx ? 1 : -1;
    return Math.min(Math.max(tx + side * min, 24), width - 24);
  };

  // Biome-true picks. snow flag only in the actual snow band.
  const bandSnow = (elevation: number) => elevation >= 0.85;
  const roundTree = (r: number) => (r < 0.5 ? 1 : 3); // leafy variants
  const pineTree = (r: number) => (r < 0.5 ? 0 : 2); // pine variants

  // 1) Edge rhythm down both sides, background scale, biome-matched.
  const edgeTop = topY - 30;
  // Run down into the meadow below basecamp so the map's bottom stretch
  // (above the tab bar) stays part of the scene.
  const edgeBottom = bottomY + 160;
  const step = 130;
  let k = 0;
  for (let y = edgeTop; y < edgeBottom; y += step, k++) {
    for (const sideSign of [-1, 1]) {
      const rA = hash01(k * 53 + (sideSign < 0 ? 7 : 19));
      if (rA < 0.2) continue;
      const rB = hash01(k * 59 + (sideSign < 0 ? 31 : 47));
      const gy = y + rA * 70;
      const elevation = elevAt(gy);
      const x = sideSign < 0 ? 16 + rB * 26 : width - 16 - rB * 26;

      if (elevation >= 0.85) {
        // Snow band: clouds only — the summit + peak range own this zone.
        if (rB >= 0.5) continue;
        out.push({
          x,
          y: gy,
          kind: "cloud",
          size: 44 + Math.round(rB * 20),
          snow: true,
          variant: k % 2,
          opacity: 0.55,
        });
      } else if (elevation >= 0.62) {
        // Gravel band: boulders/pebbles with snow-dusted pines between them.
        const isRock = rB < 0.55;
        out.push({
          x,
          y: gy,
          kind: isRock ? "rock" : "tree",
          size: isRock ? 20 + Math.round(rB * 14) : 44 + Math.round(rB * 20),
          snow: !isRock,
          variant: isRock ? k % 3 : pineTree(hash01(k * 61 + 13)),
          opacity: isRock ? 0.8 : 0.75,
        });
      } else {
        // Forest pines / meadow round trees.
        const r = hash01(k * 61 + 13);
        out.push({
          x,
          y: gy,
          kind: "tree",
          size: 46 + Math.round(rB * 24),
          snow: false,
          variant: elevation < 0.3 ? roundTree(r) : pineTree(r),
          opacity: 0.7,
        });
      }
    }
  }

  // 2) Bend pockets: one feature beside each node, on its outer side (the
  //    trail bends around it — that's the natural clearing).
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const r0 = hash01(i * 7 + 1);
    if (r0 < 0.3) continue;
    const r1 = hash01(i * 13 + 2);
    const r2 = hash01(i * 17 + 4);
    const elevation = elevAt(node.y);
    const snow = bandSnow(elevation);

    const offCenter = node.x - cx;
    // Nodes near center have no outer pocket — skip, keep the trail clear.
    if (Math.abs(offCenter) < amplitude * 0.35) continue;
    const side = offCenter >= 0 ? 1 : -1;
    const dist = 60 + r1 * 28;
    const x = Math.min(Math.max(node.x + side * dist, 44), width - 44);
    const gy = node.y + 34 + r2 * 22;

    // Snow band pockets stay empty — clouds + peak range live up there.
    if (elevation >= 0.85) continue;
    let kind: JourneyDecorationKind;
    if (elevation < 0.62) kind = r1 < 0.55 ? "trees" : "tree";
    else kind = r1 < 0.6 ? "rock" : "tree"; // gravel: boulder or snow pine

    const size =
      kind === "rock"
        ? 26 + Math.round(r2 * 16)
        : kind === "trees"
          ? 66 + Math.round(r2 * 24)
          : elevation >= 0.62
            ? 46 + Math.round(r2 * 18) // gravel snow pine, slightly smaller
            : 56 + Math.round(r2 * 24);

    const treeR = hash01(i * 29 + 8);
    out.push({
      x,
      y: gy,
      kind,
      size,
      snow: kind === "tree" && elevation >= 0.62 ? true : snow,
      variant:
        kind === "rock"
          ? i % 3
          : elevation < 0.3
            ? roundTree(treeR)
            : pineTree(treeR),
      opacity: 1,
    });
  }

  // 3) Meadow field: round trees scattered across the WHOLE field width
  //    (not just the edges), kept clear of the trail.
  const meadowTopY = yAt(0.28);
  const meadowSpan = bottomY + 150 - meadowTopY;
  for (let g = 0; g < 7; g++) {
    const rA = hash01(g * 67 + 21);
    const rB = hash01(g * 83 + 5);
    const rC = hash01(g * 89 + 15);
    const gy = meadowTopY + rA * meadowSpan;
    const x = clearOfTrail(28 + rB * (width - 56), gy, 70);
    out.push({
      x,
      y: gy,
      kind: "tree",
      size: 40 + Math.round(rC * 22),
      snow: false,
      variant: roundTree(rC),
      opacity: 0.92,
    });
  }

  // Grass tufts spread across the first two bands (field + forest), not just
  // packed near basecamp — from below the camp up through ~0.45 elevation.
  const grassTopY = yAt(0.45);
  const grassBottomY = bottomY + 150;
  for (let g = 0; g < 14; g++) {
    const rA = hash01(g * 71 + 3);
    const rB = hash01(g * 73 + 9);
    const gy = grassTopY + rA * (grassBottomY - grassTopY);
    const x = clearOfTrail(28 + rB * (width - 56), gy, 56);
    out.push({
      x,
      y: gy,
      kind: "grass",
      size: 14 + Math.round(rB * 10),
      snow: false,
      variant: 0,
      opacity: 0.9,
    });
  }

  // 4) Forest stretch: extra pines beside the trail so the mid-climb doesn't
  //    read as empty. Strictly inside the forest band.
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const gy = node.y + 16 + hash01(i * 91 + 5) * 22;
    const elevation = elevAt(gy);
    if (elevation < 0.3 || elevation >= 0.62) continue;
    const r = hash01(i * 91 + 5);
    const side = i % 2 === 0 ? -1 : 1;
    const x = clearOfTrail(node.x + side * (74 + r * 30), gy, 70);
    out.push({
      x,
      y: gy,
      kind: "tree",
      size: 50 + Math.round(r * 16),
      snow: false,
      variant: pineTree(r),
      opacity: 0.95,
    });
  }
  // Plus pines scattered across the whole forest band width, for density.
  const forestTopY = yAt(0.7);
  const forestSpan = yAt(0.32) - forestTopY;
  for (let g = 0; g < 12; g++) {
    const rA = hash01(g * 105 + 13);
    const rB = hash01(g * 106 + 27);
    const rC = hash01(g * 112 + 9);
    const gy = forestTopY + rA * forestSpan;
    const x = clearOfTrail(28 + rB * (width - 56), gy, 70);
    out.push({
      x,
      y: gy,
      kind: rC < 0.3 ? "trees" : "tree",
      size: 44 + Math.round(rC * 22),
      snow: false,
      variant: pineTree(rC),
      opacity: 0.9,
    });
  }

  // 5) Gravel band: pebbles/boulders scattered across the whole band.
  const rockTopY = yAt(0.83);
  const rockSpan = yAt(0.64) - rockTopY;
  for (let g = 0; g < 12; g++) {
    const rA = hash01(g * 101 + 7);
    const rB = hash01(g * 103 + 19);
    const gy = rockTopY + rA * rockSpan;
    const x = clearOfTrail(28 + rB * (width - 56), gy, 66);
    out.push({
      x,
      y: gy,
      kind: "rock",
      size: 18 + Math.round(rB * 18),
      snow: false,
      variant: g % 3,
      opacity: 0.95,
    });
  }

  // 6) Gravel band: snow-dusted pines flanking the trail between the rocks.
  let gravelPines = 0;
  for (let i = 0; i < n && gravelPines < 4; i++) {
    const node = nodes[i];
    const gy = node.y + 40 + hash01(i * 97 + 11) * 26;
    const elevation = elevAt(gy);
    if (elevation < 0.62 || elevation >= 0.85) continue;
    const r = hash01(i * 97 + 11);
    const side = i % 2 === 0 ? 1 : -1;
    const x = clearOfTrail(node.x + side * (70 + r * 28), gy, 66);
    out.push({
      x,
      y: gy,
      kind: "tree",
      size: 46 + Math.round(r * 16),
      snow: true,
      variant: pineTree(r),
      opacity: 0.95,
    });
    gravelPines++;
  }

  // 6b) Two more snow-dusted pines pinned to the RIGHT of the trail in the
  //     gravel band, so the right side isn't bare between the rocks.
  let gravelRight = 0;
  for (let i = n - 1; i >= 0 && gravelRight < 2; i--) {
    const node = nodes[i];
    const gy = node.y - 20 - hash01(i * 131 + 7) * 24;
    const elevation = elevAt(gy);
    if (elevation < 0.62 || elevation >= 0.85) continue;
    const r = hash01(i * 131 + 7);
    const x = clearOfTrail(node.x + (78 + r * 30), gy, 66);
    out.push({
      x,
      y: gy,
      kind: "tree",
      size: 48 + Math.round(r * 16),
      snow: true,
      variant: pineTree(r),
      opacity: 0.95,
    });
    gravelRight++;
  }

  // 7) Background mountain range — distant peaks spread across the FULL page
  //    width so the finish reads like a real massif, not a cluster on one side.
  //    `fx` is an absolute fraction of width; feet sit on the summit base line.
  // Edge peaks hang slightly off-screen so the range reaches both edges
  // instead of leaving an inset strip that reads as padding. fx values are
  // evenly spaced 0→1 so the peaks don't bunch on one side.
  const clampX = (x: number) => Math.min(Math.max(x, 8), width - 8);
  const rangePeaks: {
    fx: number;
    e: number;
    size: number;
    v: number;
    o: number;
  }[] = [
    { fx: 0.0, e: 0.86, size: 190, v: 1, o: 0.88 },
    { fx: 0.17, e: 0.85, size: 150, v: 0, o: 0.9 },
    { fx: 0.34, e: 0.84, size: 140, v: 1, o: 0.95 },
    { fx: 0.5, e: 0.85, size: 180, v: 0, o: 0.95 },
    { fx: 0.66, e: 0.85, size: 140, v: 1, o: 0.95 },
    { fx: 0.83, e: 0.86, size: 280, v: 0, o: 0.9 },
    { fx: 0.86, e: 0.85, size: 120, v: 1, o: 0.88 },
  ];
  for (const p of rangePeaks) {
    out.push({
      x: clampX(width * p.fx),
      y: yAt(p.e),
      kind: "peak",
      size: p.size,
      snow: true,
      variant: p.v,
      opacity: p.o,
    });
  }

  // Nothing may crowd a milestone chest (56px sprite + tap target).
  // Clouds float and peaks are background (the chest draws on top of them
  // with its own backplate), so only ground clutter gets cleared.
  const filtered = out.filter((d) => {
    if (d.kind === "cloud" || d.kind === "peak") return true;
    return chests.every(
      (chest) => Math.abs(d.x - chest.x) > 64 || Math.abs(d.y - chest.y) > 70,
    );
  });

  // Painter's order: things higher on the mountain draw behind lower ones.
  filtered.sort((a, b) => a.y - b.y);
  return filtered;
}

export function buildJourneyLayout(
  courses: PersonalizedPathCourse[],
  progressByCourse: Map<number, PersonalizedPathCourseProgress>,
  width: number,
  opts?: {
    /** Extra map height below basecamp (e.g. the docked detours strip). */
    bottomExtra?: number;
  },
): JourneyLayout {
  const n = courses.length;
  const cx = width / 2;
  const amplitude = Math.min(width * 0.21, 90);
  const bottomExtra = opts?.bottomExtra ?? 0;

  const metricsList = courses.map((course) =>
    getCourseMetrics(course, progressByCourse),
  );
  const currentIndex = courses.findIndex(
    (course, i) => !course.locked && !metricsList[i].isComplete,
  );

  const baseHeight = TOP_PAD + Math.max(n - 1, 0) * NODE_SPACING + BOTTOM_PAD;
  const height = baseHeight + bottomExtra;

  const nodes: JourneyNodeModel[] = courses.map((course, i) => ({
    course,
    metrics: metricsList[i],
    state: nodeStateFor(course, metricsList[i], i, currentIndex),
    x: cx + amplitude * WAVE[i % WAVE.length],
    y: TOP_PAD + (n - 1 - i) * NODE_SPACING,
  }));

  // Milestone chest after every 3rd node, mirrored to the free side.
  // ── Chest position knobs ──────────────────────────────────────────────
  // CHEST_MIRROR : how far across from the trail the chest sits (bigger = further out).
  // CHEST_X_NUDGE: extra horizontal shift in px (negative = left, positive = right).
  // CHEST_Y_NUDGE: extra vertical shift in px (negative = up, positive = down).
  const CHEST_MIRROR = 1.8;
  const CHEST_X_NUDGE = -20;
  const CHEST_Y_NUDGE = 10;
  const chests: JourneyChestModel[] = [];
  for (let i = 2; i < n - 1; i += 3) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const midX = (a.x + b.x) / 2;
    // currentIndex === -1 means the whole path is done (everything reached).
    const reached = currentIndex < 0 || currentIndex >= i;
    chests.push({
      x: cx - (midX - cx) * CHEST_MIRROR + CHEST_X_NUDGE,
      y: (a.y + b.y) / 2 + CHEST_Y_NUDGE,
      unlocked: nodes.slice(0, i + 1).every((nd) => nd.state === "done"),
      reached,
    });
  }

  // Basecamp anchors to the un-extended map bottom so the detours strip can
  // live in the `bottomExtra` band below it.
  const basecamp = {
    x: n > 0 ? nodes[0].x : cx,
    y: baseHeight - BOTTOM_PAD + 96,
  };
  // The finish: the summit mountain is a BACKGROUND object. Its base starts
  // where the gravel band ends, it fills the whole snow band, and the trail
  // (drawn over it) winds across its face — the last nodes climb the mountain
  // itself, ending at the tip. TOP_PAD keeps the tip clear of the header.
  const climbBottomY = n > 0 ? nodes[0].y : TOP_PAD;
  const climbTopY = n > 0 ? nodes[n - 1].y : TOP_PAD;
  const climbSpan = Math.max(climbBottomY - climbTopY, 1);
  const gravelEndY = climbBottomY - 0.85 * climbSpan;
  // Massive: 1.4× the snow band so the mountain dominates the top of the map.
  const summitHeight = Math.max((gravelEndY - (TOP_PAD - 90)) * 1.5, 160);
  const summitTipY = gravelEndY - summitHeight;
  const lastX = n > 0 ? nodes[n - 1].x : cx;
  const summitSide = lastX >= cx ? -1 : 1;
  const summitSprite = {
    x: Math.min(Math.max(cx + summitSide * width * 0.08, 90), width - 90),
    y: gravelEndY,
    height: summitHeight,
  };
  const summit = { x: summitSprite.x, y: summitTipY + 30 };

  // A chest can land on the mountain face (gravel/snow band, y above the
  // mountain base). Drop those down to the base and nudge left of the
  // mountain so the chest stays grounded and clear of the summit sprite.
  for (const chest of chests) {
    if (chest.y < gravelEndY) {
      chest.y = gravelEndY + 6;
      chest.x = Math.max(summitSprite.x - width * 0.28, 40);
    }
  }

  const lockedNodes = nodes.filter((nd) => nd.state === "locked");
  const fogBottomY =
    lockedNodes.length > 0
      ? Math.max(...lockedNodes.map((nd) => nd.y)) + NODE_SPACING * 0.55
      : 0;

  const trail = buildTrail(nodes, basecamp, summit, currentIndex);
  const decorations = buildDecorations(nodes, width, cx, amplitude, chests);

  return {
    nodes,
    chests,
    trail,
    decorations,
    width,
    height,
    currentIndex,
    fogBottomY,
    summit,
    summitSprite,
    basecamp,
  };
}

/** Minutes left to summit across unlocked, unfinished courses. */
export function remainingMinutes(nodes: JourneyNodeModel[]): number {
  return Math.round(
    nodes.reduce((sum, nd) => {
      if (nd.state === "done" || nd.state === "locked") return sum;
      return sum + nd.metrics.estimatedMinutes * (1 - nd.metrics.percent / 100);
    }, 0),
  );
}

const ICON_KEYWORDS: [string[], string][] = [
  [["income", "expense", "salary"], "cash-multiple"],
  [["budget"], "calculator-variant"],
  [["saving", "emergency"], "piggy-bank"],
  [["invest", "stock", "portfolio"], "chart-line"],
  [["crypto", "defi", "bitcoin"], "bitcoin"],
  [["forex", "trading", "technical"], "chart-areaspline"],
  [["debt", "credit", "loan"], "credit-card-outline"],
  [["mortgage", "property", "real estate", "rental"], "home-city-outline"],
  [["tax"], "file-percent-outline"],
  [["insurance", "safety", "protection", "risk"], "shield-check-outline"],
  [["retirement", "pension"], "beach"],
  [["goal", "clarity", "planning"], "target"],
  [
    ["mindset", "psychology", "discipline", "resilience"],
    "head-lightbulb-outline",
  ],
  [["bank", "account"], "bank-outline"],
];

/** Rotation so untagged neighbours still get distinct icons. */
const ICON_FALLBACKS = [
  "book-open-variant",
  "school-outline",
  "scale-balance",
  "trending-up",
  "wallet-outline",
  "chart-donut",
  "compass-outline",
  "trophy-outline",
] as const;

/**
 * Icon per course. Course title wins over path title; untagged courses
 * rotate through a fallback set keyed by course id so icons stay varied.
 */
export function journeyNodeIcon(course: PersonalizedPathCourse): string {
  const hay = `${course.title ?? ""} ${course.path_title ?? ""}`.toLowerCase();
  for (const [words, icon] of ICON_KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return icon;
  }
  return ICON_FALLBACKS[
    Math.abs(Number(course.id) || 0) % ICON_FALLBACKS.length
  ];
}
