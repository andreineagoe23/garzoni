import React from "react";
import {
  FaBullseye,
  FaBook,
  FaBookOpen,
  FaBolt,
  FaChartLine,
  FaFire,
  FaLightbulb,
  FaRobot,
  FaMicrophone,
  FaRocket,
  FaSnowflake,
  FaArrowsRotate,
  FaTriangleExclamation,
  FaHourglassHalf,
  FaStar,
  FaGift,
  FaTrophy,
  FaCircleQuestion,
  FaUser,
  FaGear,
  FaHouse,
  FaDumbbell,
  FaWrench,
  FaLock,
  FaDownload,
  FaCheck,
  FaInbox,
  FaWandMagicSparkles,
  FaVolumeHigh,
  FaBars,
  FaXmark,
} from "react-icons/fa6";

export type GarzoniIconName =
  | "target"
  | "book"
  | "bookOpen"
  | "home"
  | "dumbbell"
  | "tools"
  | "trophy"
  | "gift"
  | "question"
  | "user"
  | "gear"
  | "star"
  | "rocket"
  | "lightbulb"
  | "sparkles"
  | "fire"
  | "bolt"
  | "snowflake"
  | "sync"
  | "chartLine"
  | "warning"
  | "hourglass"
  | "robot"
  | "microphone"
  | "lock"
  | "download"
  | "check"
  | "volume"
  | "inbox"
  | "bars"
  | "xmark";

const ICONS = {
  target: FaBullseye,
  book: FaBook,
  bookOpen: FaBookOpen,
  home: FaHouse,
  dumbbell: FaDumbbell,
  tools: FaWrench,
  trophy: FaTrophy,
  gift: FaGift,
  question: FaCircleQuestion,
  user: FaUser,
  gear: FaGear,
  star: FaStar,
  rocket: FaRocket,
  lightbulb: FaLightbulb,
  sparkles: FaWandMagicSparkles,
  fire: FaFire,
  bolt: FaBolt,
  snowflake: FaSnowflake,
  sync: FaArrowsRotate,
  chartLine: FaChartLine,
  warning: FaTriangleExclamation,
  hourglass: FaHourglassHalf,
  robot: FaRobot,
  microphone: FaMicrophone,
  lock: FaLock,
  download: FaDownload,
  check: FaCheck,
  inbox: FaInbox,
  volume: FaVolumeHigh,
  bars: FaBars,
  xmark: FaXmark,
} as unknown as Record<
  GarzoniIconName,
  React.ComponentType<Record<string, unknown>>
>;

const EMOJI_TO_ICON_NAME: Partial<Record<string, GarzoniIconName>> = {
  "🎯": "target",
  "📚": "book",
  "📖": "bookOpen",
  "🏠": "home",
  "💪": "dumbbell",
  "🛠️": "tools",
  "🏆": "trophy",
  "🎁": "gift",
  "❓": "question",
  "👤": "user",
  "⚙️": "gear",
  "⭐": "star",
  "🚀": "rocket",
  "💡": "lightbulb",
  "🎉": "sparkles",
  "⚡": "bolt",
  "❄️": "snowflake",
  "🔄": "sync",
  "📈": "chartLine",
  "⚠️": "warning",
  "⏳": "hourglass",
  "🤖": "robot",
  "🎙": "microphone",
  "🔒": "lock",
  "⬇️": "download",
  "✓": "check",
  "🔊": "volume",
  "📭": "inbox",
};

type GarzoniIconProps = {
  name: GarzoniIconName | string;
  size?: number;
  className?: string;
  "aria-hidden"?: true;
};

/**
 * Single place to import and render FontAwesome Free icons (via react-icons).
 * This avoids sprinkling emojis/emoji-like spans around the UI.
 */
export function GarzoniIcon({
  name,
  size = 16,
  className = "",
  ...rest
}: GarzoniIconProps) {
  const resolvedName =
    (Object.prototype.hasOwnProperty.call(ICONS, name)
      ? (name as GarzoniIconName)
      : EMOJI_TO_ICON_NAME[name]) ?? null;

  if (!resolvedName) return null;

  const Icon = ICONS[resolvedName];
  return React.createElement(Icon, {
    size,
    className,
    "aria-hidden": rest["aria-hidden"] ?? true,
    "data-testid": "garzoni-icon",
    focusable: "false",
  });
}
