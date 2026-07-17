import React, { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeContext";
import { radius } from "../../theme/tokens";
import { hash01 } from "@garzoni/core";
import {
  CampsiteSprite,
  CloudSprite,
  GrassSprite,
  MascotSprite,
  PeakSprite,
  SummitSprite,
  TreasureChestSprite,
  TreeClusterSprite,
  TreeSprite,
} from "../journey/JourneyScenery";
import { sceneForPath, type SceneSprite } from "./pathScenes";

const HEADER_H = 110;
const GROUND_H = 24;

/**
 * Filled region covering everything below a wavy boundary at `yBase` —
 * the card's ground band, with the same organic edge as JourneyBackdrop.
 */
function wavyGround(
  yBase: number,
  width: number,
  height: number,
  seed: number,
): string {
  const segs = 4;
  const segW = width / segs;
  const y0 = yBase + (hash01(seed) - 0.5) * 8;
  let d = `M 0 ${y0}`;
  let prevY = y0;
  for (let i = 1; i <= segs; i++) {
    const x = i * segW;
    const y = yBase + (hash01(seed + i * 7.3) - 0.5) * 10;
    d += ` C ${x - segW * 0.6} ${prevY}, ${x - segW * 0.42} ${y}, ${x} ${y}`;
    prevY = y;
  }
  d += ` L ${width} ${height + 2} L 0 ${height + 2} Z`;
  return d;
}

function SceneSpriteView({ sprite }: { sprite: SceneSprite }) {
  const { kind, size, variant = 0, snow = false } = sprite;
  switch (kind) {
    case "tree":
      return <TreeSprite height={size} snow={snow} variant={variant} />;
    case "treeCluster":
      return <TreeClusterSprite height={size} snow={snow} variant={variant} />;
    case "peak":
      return <PeakSprite width={size} variant={variant} />;
    case "cloud":
      return <CloudSprite width={size} variant={variant} />;
    case "grass":
      return <GrassSprite height={size} />;
    case "summit":
      return <SummitSprite height={size} />;
    case "campsite":
      return <CampsiteSprite width={size} />;
    case "chest":
      return <TreasureChestSprite height={size} />;
    case "mascot":
      return sprite.mascot ? (
        <MascotSprite mascot={sprite.mascot} height={size} />
      ) : null;
  }
}

type Props = {
  title: string;
  pathId?: number;
  /** 0–100; at 100 a small summit "flag planted" marker appears. */
  progressPct?: number;
  height?: number;
};

/**
 * Composed mini-scene card header — per-topic gradient sky, wavy ground
 * band, and journey sprites. Replaces the old AI-generated cover images.
 */
function PathSceneHeader({
  title,
  pathId,
  progressPct = 0,
  height = HEADER_H,
}: Props) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [w, setW] = useState(0);

  const recipe = useMemo(() => sceneForPath(title, pathId), [title, pathId]);
  const sky = recipe.sky[dark ? "dark" : "light"];
  const ground = recipe.ground[dark ? "dark" : "light"];
  const seed = recipe.key.length * 13 + (pathId ?? 0);

  const sprites: SceneSprite[] = useMemo(() => {
    if (progressPct >= 100 && recipe.key !== "default") {
      return [...recipe.sprites, { kind: "summit", x: 0.93, size: 32 }];
    }
    return recipe.sprites;
  }, [recipe, progressPct]);

  const gradientId = `scene-sky-${recipe.key}`;

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        width: "100%",
        height,
        overflow: "hidden",
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
      }}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky[0]} />
            <Stop offset="1" stopColor={sky[1]} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width="100%"
          height={height}
          fill={`url(#${gradientId})`}
        />
        {w > 0 ? (
          <Path
            d={wavyGround(height - GROUND_H, w, height, seed)}
            fill={ground}
          />
        ) : null}
      </Svg>

      {w > 0
        ? sprites.map((s, i) => (
            <View
              key={`${recipe.key}-${i}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: s.x * w - 80,
                bottom: GROUND_H - 10 + (s.lift ?? 0),
                width: 160,
                alignItems: "center",
                opacity: s.opacity ?? 1,
                transform: s.flip ? [{ scaleX: -1 }] : undefined,
              }}
            >
              <SceneSpriteView sprite={s} />
            </View>
          ))
        : null}
    </View>
  );
}

export default React.memo(PathSceneHeader);
