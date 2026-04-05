import CircularProgressRing from "../ui/CircularProgressRing";
import { useThemeColors } from "../../theme/ThemeContext";

type Props = {
  /** 0–1 */
  value: number;
  size?: number;
  strokeWidth?: number;
};

/** Theme-aware course progress ring (wraps shared CircularProgressRing). */
export default function ProgressRing({ value, size = 52, strokeWidth = 5 }: Props) {
  const c = useThemeColors();
  return (
    <CircularProgressRing
      value={value}
      size={size}
      strokeWidth={strokeWidth}
      trackColor={c.border}
      activeColor={c.primary}
    />
  );
}
