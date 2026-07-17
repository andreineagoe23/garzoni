/**
 * JourneyMapWeb — SVG port of "The Climb" personalized-path journey map
 * (UX plan 3.2). Reuses the pure layout math from @garzoni/core
 * (`buildJourneyLayout`) that the mobile map consumes, and renders a clean,
 * functional, on-brand winding trail in React/SVG.
 *
 * Deliberately NOT a pixel parity with mobile: no mascots, no biome scenery,
 * no fog-of-war sprites. Just the trail, the course nodes with progress, a
 * gradient backdrop, and basecamp/summit anchors — the visual-delight gap the
 * web dashboard's all-zero stat grid leaves open.
 *
 * Node taps: unlocked → the course flow route (via `onCourseClick`, same
 * handler the list view uses); locked → /subscriptions?reason=journey (the
 * ready-made endowment paywall surface).
 *
 * Copy is hardcoded English by design — the repo i18n test forbids unknown
 * t() keys, and Phase 1/2 web components (FirstWeekChecklist) set the same
 * precedent.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildJourneyLayout,
  type JourneyNodeModel,
  type JourneyNodeState,
  type PersonalizedPathCourse,
  type PersonalizedPathCourseProgress,
} from "@garzoni/core";

type Props = {
  courses: PersonalizedPathCourse[];
  progressByCourse: Map<number, PersonalizedPathCourseProgress>;
  /** Same course-open handler the list view uses (unlocked nodes). */
  onCourseClick?: (courseId: number, pathId?: number) => void;
  /** Humanized onboarding goals, joined for the header sub-line. */
  goalsLine?: string;
  /** Upgrade nudge shown floating over the fog band, when present. */
  upgradePrompt?: string;
};

const NODE_R = 26;
const RING_R = 32;

/** Per-state visual tokens for a node's core disc. */
function nodeColors(state: JourneyNodeState): {
  fill: string;
  border: string;
  text: string;
} {
  switch (state) {
    case "done":
      return {
        fill: "var(--color-brand-primary)",
        border: "var(--color-brand-primary)",
        text: "#ffffff",
      };
    case "current":
      return {
        fill: "var(--color-brand-primary)",
        border: "#ffffff",
        text: "#ffffff",
      };
    case "next":
      return {
        fill: "var(--color-surface-card, #ffffff)",
        border: "var(--color-brand-primary)",
        text: "var(--color-brand-primary)",
      };
    case "locked":
      return {
        fill: "var(--color-surface-card, #ffffff)",
        border: "var(--color-border-default, #cbd5e1)",
        text: "var(--color-border-default, #94a3b8)",
      };
    default:
      return {
        fill: "var(--color-surface-card, #ffffff)",
        border: "var(--color-border-default, #cbd5e1)",
        text: "var(--color-content-muted, #64748b)",
      };
  }
}

function JourneyNodeSvg({
  node,
  onOpen,
}: {
  node: JourneyNodeModel;
  onOpen: (node: JourneyNodeModel) => void;
}) {
  const { fill, border, text } = nodeColors(node.state);
  const percent = Math.max(0, Math.min(100, Math.round(node.metrics.percent)));
  const ringCirc = 2 * Math.PI * RING_R;
  const ringOffset = ringCirc - (percent / 100) * ringCirc;
  const label = node.course.title || "Course";

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label} — ${
        node.state === "locked"
          ? "locked, upgrade to unlock"
          : `${percent}% complete`
      }`}
      onClick={() => onOpen(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(node);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Progress ring (background + climbed arc) */}
      <circle
        cx={node.x}
        cy={node.y}
        r={RING_R}
        fill="none"
        stroke="var(--color-border-default, #e2e8f0)"
        strokeWidth={4}
        opacity={0.5}
      />
      {node.state !== "locked" && percent > 0 ? (
        <circle
          cx={node.x}
          cy={node.y}
          r={RING_R}
          fill="none"
          stroke="var(--color-brand-primary)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={ringCirc}
          strokeDashoffset={ringOffset}
          transform={`rotate(-90 ${node.x} ${node.y})`}
        />
      ) : null}

      {/* Core disc */}
      <circle
        cx={node.x}
        cy={node.y}
        r={NODE_R}
        fill={fill}
        stroke={border}
        strokeWidth={node.state === "current" ? 3 : 2}
      />
      {node.state === "current" ? (
        <circle
          cx={node.x}
          cy={node.y}
          r={NODE_R + 6}
          fill="none"
          stroke="var(--color-brand-primary)"
          strokeWidth={2}
          opacity={0.35}
        />
      ) : null}

      {/* Glyph: check when done, lock when locked, otherwise % label */}
      {node.state === "done" ? (
        <path
          d={`M ${node.x - 9} ${node.y} l 6 6 l 12 -13`}
          fill="none"
          stroke={text}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : node.state === "locked" ? (
        <text
          x={node.x}
          y={node.y + 6}
          textAnchor="middle"
          fontSize={18}
          fill={text}
          aria-hidden
        >
          {"🔒"}
        </text>
      ) : (
        <text
          x={node.x}
          y={node.y + 5}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill={text}
        >
          {percent}%
        </text>
      )}

      {/* Course title pill under the node */}
      <foreignObject
        x={node.x - 80}
        y={node.y + RING_R + 6}
        width={160}
        height={46}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            lineHeight: 1.25,
            fontWeight: 600,
            color: "var(--color-content-primary, #0f172a)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
}

export default function JourneyMapWeb({
  courses,
  progressByCourse,
  onCourseClick,
  goalsLine,
  upgradePrompt,
}: Props) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  // Measure the container so the pure layout math gets a real width. Clamp to
  // 360 (the responsive floor) so the map never collapses on narrow screens.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(320, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => buildJourneyLayout(courses, progressByCourse, width),
    [courses, progressByCourse, width]
  );

  const overall = useMemo(() => {
    const unlocked = layout.nodes.filter((n) => n.state !== "locked");
    if (unlocked.length === 0) return 0;
    return Math.round(
      unlocked.reduce((sum, n) => sum + n.metrics.percent, 0) / unlocked.length
    );
  }, [layout.nodes]);

  const currentNode =
    layout.currentIndex >= 0 ? layout.nodes[layout.currentIndex] : null;

  const openNode = (node: JourneyNodeModel) => {
    const course = node.course;
    if (course.locked || node.state === "locked") {
      navigate("/subscriptions?reason=journey");
      return;
    }
    onCourseClick?.(course.id, Number(course.path || 0) || undefined);
  };

  const hasFog = layout.fogBottomY > 0;

  return (
    <div className="space-y-3">
      {/* Header — mirrors the mobile climb header, minus the sprites */}
      <div className="rounded-2xl bg-gradient-to-r from-[#2a7347] to-[#1d5330] px-4 py-3 text-white shadow-lg shadow-[#1d5330]/30">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/75">
          The Climb{goalsLine ? ` · ${goalsLine.toUpperCase()}` : ""}
        </p>
        <p className="mt-0.5 text-base font-extrabold">
          {currentNode?.course.title ?? "Summit"}
        </p>
        <p className="text-xs text-white/75">{overall}% climbed to the top</p>
      </div>

      <div
        ref={containerRef}
        className="relative max-h-[70vh] overflow-y-auto rounded-2xl border border-[color:var(--color-border-default)]"
        style={{ overscrollBehavior: "contain" }}
      >
        <svg
          width={width}
          height={layout.height}
          viewBox={`0 0 ${width} ${layout.height}`}
          role="img"
          aria-label="Your personalized learning path, shown as a climb"
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="journeySky" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor="var(--color-brand-primary)"
                stopOpacity={0.14}
              />
              <stop
                offset="0.55"
                stopColor="var(--color-brand-primary)"
                stopOpacity={0.05}
              />
              <stop
                offset="1"
                stopColor="var(--color-brand-primary)"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id="journeyFog" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor="var(--color-surface-card, #ffffff)"
                stopOpacity={0.92}
              />
              <stop
                offset="0.7"
                stopColor="var(--color-surface-card, #ffffff)"
                stopOpacity={0.5}
              />
              <stop
                offset="1"
                stopColor="var(--color-surface-card, #ffffff)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          {/* Gradient backdrop */}
          <rect
            x={0}
            y={0}
            width={width}
            height={layout.height}
            fill="url(#journeySky)"
          />

          {/* Trail — full path (muted) then the climbed portion (brand) */}
          <path
            d={layout.trail.d}
            fill="none"
            stroke="var(--color-border-default, #cbd5e1)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray="2 16"
            opacity={0.7}
          />
          {layout.trail.progressLength > 0 ? (
            <path
              d={layout.trail.d}
              fill="none"
              stroke="var(--color-brand-primary)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${layout.trail.progressLength} ${layout.trail.totalLength}`}
              opacity={0.9}
            />
          ) : null}

          {/* Summit marker */}
          <g aria-hidden>
            <circle
              cx={layout.summit.x}
              cy={layout.summit.y}
              r={10}
              fill="var(--color-brand-primary)"
            />
            <text
              x={layout.summit.x}
              y={layout.summit.y - 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              letterSpacing={1}
              fill="var(--color-content-muted, #64748b)"
            >
              SUMMIT
            </text>
          </g>

          {/* Basecamp marker */}
          <g aria-hidden>
            <circle
              cx={layout.basecamp.x}
              cy={layout.basecamp.y}
              r={8}
              fill="var(--color-border-default, #94a3b8)"
            />
            <text
              x={layout.basecamp.x}
              y={layout.basecamp.y + 26}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              letterSpacing={1}
              fill="var(--color-content-muted, #64748b)"
            >
              BASECAMP
            </text>
          </g>

          {/* Nodes */}
          {layout.nodes.map((node) => (
            <JourneyNodeSvg
              key={node.course.id}
              node={node}
              onOpen={openNode}
            />
          ))}

          {/* Fog band over locked plan courses */}
          {hasFog ? (
            <rect
              x={0}
              y={0}
              width={width}
              height={layout.fogBottomY}
              fill="url(#journeyFog)"
              pointerEvents="none"
            />
          ) : null}
        </svg>

        {/* Upgrade nudge floating over the fog band */}
        {hasFog || upgradePrompt ? (
          <div
            className="pointer-events-auto absolute left-1/2 w-[86%] max-w-sm -translate-x-1/2 rounded-2xl border border-[color:var(--color-brand-primary)]/40 bg-[color:var(--color-surface-card)] p-4 text-center shadow-lg"
            style={{
              top: hasFog ? Math.max(60, layout.fogBottomY * 0.35) : 60,
            }}
          >
            <p className="text-xs leading-relaxed text-content-muted">
              {upgradePrompt ||
                "Part of your route is under fog. Upgrade to unlock the full climb."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/subscriptions?reason=journey")}
              className="app-cta-btn mt-3 !h-auto !w-auto px-5 py-2 text-sm"
            >
              Unlock the full climb
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
