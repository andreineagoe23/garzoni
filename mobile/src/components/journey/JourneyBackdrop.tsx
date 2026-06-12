import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "../../theme/ThemeContext";
import { hash01, type JourneyNodeModel } from "./journeyLayout";

type Props = {
  nodes: JourneyNodeModel[];
  width: number;
  height: number;
  summit: { x: number; y: number };
};

/** Tiny "V" silhouettes gliding in the high-altitude sky. */
function BirdFlock({
  x,
  y,
  scale,
  color,
}: {
  x: number;
  y: number;
  scale: number;
  color: string;
}) {
  const w = 30 * scale;
  const h = 10 * scale;
  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 30 10"
      style={{ position: "absolute", left: x, top: y }}
    >
      <Path d="M1 7 Q 6 1 11 7" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      <Path d="M11 7 Q 16 1 21 7" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      <Path d="M18 5 Q 22 1 26 5" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Filled region covering everything above a wavy horizontal boundary at
 * `yBase` — stacked regions become terrain bands with organic edges.
 */
function wavyRegion(yBase: number, width: number, seed: number): string {
  const segs = 5;
  const segW = width / segs;
  const y0 = yBase + (hash01(seed) - 0.5) * 20;
  let d = `M 0 ${y0}`;
  let prevY = y0;
  for (let i = 1; i <= segs; i++) {
    const x = i * segW;
    const y = yBase + (hash01(seed + i * 7.3) - 0.5) * 24;
    d += ` C ${x - segW * 0.6} ${prevY}, ${x - segW * 0.42} ${y}, ${x} ${y}`;
    prevY = y;
  }
  d += ` L ${width} -2 L 0 -2 Z`;
  return d;
}

/**
 * The mountain itself — an opaque painted terrain the trail is carved into.
 * Stacked altitude bands with wavy edges: meadow → forest → rock → snow,
 * plus a sun glow behind the peak, speckles, and gliding birds.
 * This is the scene's ground; scenery sprites stand ON it, not on app bg.
 */
export default function JourneyBackdrop({ nodes, width, height, summit }: Props) {
  const { colors: c, resolved } = useTheme();
  const dark = resolved === "dark";
  if (nodes.length < 2) return null;

  const bottomY = nodes[0].y;
  const topY = nodes[nodes.length - 1].y;
  const yAt = (elevation: number) => bottomY - elevation * (bottomY - topY);

  // Band boundaries (bottom edge of each region).
  const forestY = yAt(0.3);
  const rockY = yAt(0.62);
  const snowY = yAt(0.85);

  // Terrain palette: dusk climb in dark mode, day climb in light mode.
  const meadow = dark ? "#22402c" : "#9fca82";
  const forest = dark ? "#1b3424" : "#7fb168";
  const rock = dark ? "#2a3648" : "#a7b2c3";
  const snow = dark ? "#3c4f6e" : "#e3ebf5";
  const speckSnow = dark ? "#cfe0f4" : "#ffffff";
  const speckGrass = dark ? "#3f6b4f" : "#6f9a55";
  const birdColor = dark ? "rgba(210,224,240,0.5)" : "rgba(70,90,115,0.5)";

  // Speckles: snow flecks above the snowline, grass tufts in the meadow.
  const snowDots: { x: number; y: number; r: number; o: number }[] = [];
  const grassDots: { x: number; y: number; r: number; o: number }[] = [];
  // Keep the flecks INSIDE the snow band — spilling them down the rock band
  // reads as a starry night sky instead of terrain.
  const snowTop = Math.max(summit.y - 80, 0);
  const snowCount = Math.min(40, Math.round((snowY - snowTop) / 18));
  for (let k = 0; k < snowCount; k++) {
    snowDots.push({
      x: hash01(k * 3.7 + 11) * width,
      y: snowTop + hash01(k * 5.3 + 29) * (snowY - snowTop),
      r: 1.4 + hash01(k * 7.1 + 3) * 1.5,
      o: 0.25 + hash01(k * 2.3 + 17) * 0.3,
    });
  }
  const grassBottom = Math.min(bottomY + 110, height);
  const grassCount = Math.min(30, Math.round((grassBottom - forestY) / 26));
  for (let k = 0; k < grassCount; k++) {
    grassDots.push({
      x: hash01(k * 4.1 + 53) * width,
      y: forestY + hash01(k * 6.7 + 41) * (grassBottom - forestY),
      r: 1.6 + hash01(k * 3.9 + 7) * 1.5,
      o: 0.25 + hash01(k * 5.9 + 23) * 0.25,
    });
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Soft shading so each band darkens toward its lower edge. */}
          <LinearGradient id="bandShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={dark ? 0.22 : 0.1} />
          </LinearGradient>
          <RadialGradient id="summitGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={dark ? 0.22 : 0.3} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Terrain bands, bottom-up: meadow base, then stacked regions. */}
        <Rect x={0} y={0} width={width} height={height} fill={meadow} />
        <Path d={wavyRegion(forestY, width, 5)} fill={forest} />
        <Path d={wavyRegion(rockY, width, 17)} fill={rock} />
        <Path d={wavyRegion(snowY, width, 31)} fill={snow} />

        {/* Band-edge shadow lines: soft depth where terrain changes. */}
        <Path
          d={wavyRegion(forestY, width, 5)}
          fill="none"
          stroke="#000000"
          strokeOpacity={dark ? 0.25 : 0.12}
          strokeWidth={3}
        />
        <Path
          d={wavyRegion(rockY, width, 17)}
          fill="none"
          stroke="#000000"
          strokeOpacity={dark ? 0.25 : 0.12}
          strokeWidth={3}
        />
        <Path
          d={wavyRegion(snowY, width, 31)}
          fill="none"
          stroke="#000000"
          strokeOpacity={dark ? 0.2 : 0.1}
          strokeWidth={3}
        />

        {/* Subtle darkening toward the map bottom grounds the meadow. */}
        <Rect
          x={0}
          y={bottomY}
          width={width}
          height={Math.max(height - bottomY, 0)}
          fill="url(#bandShade)"
        />

        {/* Sun glow cresting behind the peak */}
        <Circle cx={summit.x} cy={summit.y - 24} r={130} fill="url(#summitGlow)" />

        {snowDots.map((d, i) => (
          <Circle key={`s${i}`} cx={d.x} cy={d.y} r={d.r} fill={speckSnow} opacity={d.o} />
        ))}
        {grassDots.map((d, i) => (
          <Circle key={`g${i}`} cx={d.x} cy={d.y} r={d.r} fill={speckGrass} opacity={d.o} />
        ))}
      </Svg>

      {/* Birds gliding across the rock band */}
      <BirdFlock x={width * 0.24} y={yAt(0.74)} scale={1} color={birdColor} />
      <BirdFlock x={width * 0.62} y={yAt(0.5)} scale={0.75} color={birdColor} />
    </View>
  );
}
