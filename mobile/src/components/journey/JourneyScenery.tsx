import { Image, View, type ImageStyle } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { cloudinaryImageUrl, type MascotType } from "@garzoni/core";

/**
 * Journey map scenery — baked 3D sprites (Meshy → Blender), transparent PNGs.
 * Assets hosted on Cloudinary under garzoni/journey/<slug>.
 */

function cdn(slug: string): { uri: string } {
  return { uri: cloudinaryImageUrl(`garzoni/journey/${slug}`, "f_auto,q_auto") };
}

type SpriteDef = {
  src: { uri: string };
  w: number;
  h: number;
};

const TREES_GREEN: SpriteDef[] = [
  { src: cdn("tree-pine"), w: 278, h: 512 },
  { src: cdn("tree-round"), w: 512, h: 444 },
  { src: cdn("tree-pine-crooked"), w: 278, h: 512 },
  { src: cdn("tree-round-tall"), w: 512, h: 444 },
];

const TREES_SNOW: SpriteDef[] = [
  { src: cdn("tree-pine-snow"), w: 372, h: 512 },
  { src: cdn("tree-pine-snow-2"), w: 372, h: 512 },
  { src: cdn("tree-round-snow"), w: 372, h: 512 },
];

const PEAKS: SpriteDef[] = [
  { src: cdn("peak"), w: 512, h: 365 },
  { src: cdn("peak-2"), w: 512, h: 365 },
];

const CLOUDS: SpriteDef[] = [
  { src: cdn("cloud"), w: 512, h: 462 },
  { src: cdn("cloud-2"), w: 512, h: 462 },
];

const GRASS: SpriteDef = {
  src: cdn("grass"),
  w: 26,
  h: 29,
};

const SUMMIT: SpriteDef = {
  src: cdn("summit-mountain"),
  w: 512,
  h: 478,
};

const CAMPSITE: SpriteDef = {
  src: cdn("campsite"),
  w: 512,
  h: 334,
};

const CHEST: SpriteDef = {
  src: cdn("treasure-chest"),
  w: 459,
  h: 512,
};

const MASCOTS: Record<MascotType, SpriteDef> = {
  owl: { src: cdn("mascot-owl"), w: 512, h: 413 },
  bull: { src: cdn("mascot-bull"), w: 323, h: 512 },
  bear: { src: cdn("mascot-bear"), w: 329, h: 512 },
};

function Sprite({
  def,
  height,
  width,
  style,
  opacity = 1,
}: {
  def: SpriteDef;
  height?: number;
  width?: number;
  style?: ImageStyle;
  opacity?: number;
}) {
  const aspect = def.w / def.h;
  const h = height ?? (width != null ? width / aspect : def.h);
  const w = width ?? h * aspect;
  return (
    <Image
      source={def.src}
      style={[{ width: w, height: h, resizeMode: "contain", opacity }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}

export function TreeSprite({
  height,
  snow = false,
  variant = 0,
}: {
  height: number;
  snow?: boolean;
  variant?: number;
}) {
  const pool = snow ? TREES_SNOW : TREES_GREEN;
  return <Sprite def={pool[variant % pool.length]} height={height} />;
}

export function TreeClusterSprite({
  height,
  snow = false,
  variant = 0,
}: {
  height: number;
  snow?: boolean;
  variant?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <TreeSprite height={height} snow={snow} variant={variant} />
      <View style={{ marginLeft: -height * 0.12 }}>
        {/* +2 keeps the companion in the same family — green pool alternates
            pine/round, so +1 would put a pine inside a meadow cluster. */}
        <TreeSprite height={height * 0.62} snow={snow} variant={variant + 2} />
      </View>
    </View>
  );
}

export function PeakSprite({
  width,
  variant = 0,
}: {
  width: number;
  variant?: number;
}) {
  const def = PEAKS[variant % PEAKS.length];
  return <Sprite def={def} width={width} />;
}

export function CloudSprite({
  width,
  variant = 0,
}: {
  width: number;
  variant?: number;
}) {
  const def = CLOUDS[variant % CLOUDS.length];
  return <Sprite def={def} width={width} />;
}

export function GrassSprite({ height }: { height: number }) {
  return <Sprite def={GRASS} height={height} />;
}

/** Snow-capped summit with flag — end of the climb. */
export function SummitSprite({ height }: { height: number }) {
  return <Sprite def={SUMMIT} height={height} />;
}

/** Basecamp tent + campfire clearing. */
export function CampsiteSprite({ width }: { width: number }) {
  return <Sprite def={CAMPSITE} width={width} />;
}

/** Milestone treasure chest along the trail. */
export function TreasureChestSprite({
  height,
  opacity = 1,
}: {
  height: number;
  /** Caller sets this from journey progress (dim when far, solid when reached). */
  opacity?: number;
}) {
  return <Sprite def={CHEST} height={height} opacity={opacity} />;
}

// Gravel-band boulders. No baked PNG exists for rocks, so these are drawn
// in SVG with the rock band's grey palette — rounded boulder blobs with a
// shaded base and a soft top highlight so they read like the other sprites.
const ROCK_BODY = "#97a1b2";
const ROCK_SHADE = "#79839a";
const ROCK_LIGHT = "#c2cbd9";

/** Cluster of boulders/pebbles for the gravel band. 3 arrangements. */
export function RockSprite({
  width,
  variant = 0,
}: {
  width: number;
  variant?: number;
}) {
  const h = width * 0.62;
  const v = ((variant % 3) + 3) % 3;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 62">
      {v === 0 ? (
        // One big boulder + pebble at its right foot.
        <>
          <Path
            d="M14 58 Q8 34 26 22 Q44 10 62 20 Q80 28 76 58 Z"
            fill={ROCK_BODY}
          />
          <Path d="M14 58 Q12 46 20 38 Q30 50 28 58 Z" fill={ROCK_SHADE} />
          <Ellipse cx={42} cy={24} rx={14} ry={6} fill={ROCK_LIGHT} opacity={0.7} />
          <Ellipse cx={86} cy={54} rx={11} ry={7} fill={ROCK_SHADE} />
          <Ellipse cx={84} cy={51} rx={9} ry={5} fill={ROCK_BODY} />
        </>
      ) : v === 1 ? (
        // Two leaning boulders.
        <>
          <Path
            d="M6 58 Q4 36 20 28 Q38 20 44 36 Q48 48 44 58 Z"
            fill={ROCK_SHADE}
          />
          <Path
            d="M36 58 Q34 30 56 22 Q80 16 88 38 Q94 50 88 58 Z"
            fill={ROCK_BODY}
          />
          <Ellipse cx={62} cy={28} rx={13} ry={5} fill={ROCK_LIGHT} opacity={0.7} />
        </>
      ) : (
        // Scatter of three pebbles.
        <>
          <Ellipse cx={20} cy={52} rx={14} ry={9} fill={ROCK_BODY} />
          <Ellipse cx={18} cy={49} rx={11} ry={6} fill={ROCK_LIGHT} opacity={0.5} />
          <Ellipse cx={52} cy={55} rx={10} ry={6} fill={ROCK_SHADE} />
          <Ellipse cx={80} cy={51} rx={13} ry={8} fill={ROCK_BODY} />
          <Ellipse cx={78} cy={48} rx={9} ry={5} fill={ROCK_LIGHT} opacity={0.5} />
        </>
      )}
    </Svg>
  );
}

/** 3D mascot standing beside the current node. */
export function MascotSprite({
  mascot,
  height,
}: {
  mascot: MascotType;
  height: number;
}) {
  return <Sprite def={MASCOTS[mascot]} height={height} />;
}
