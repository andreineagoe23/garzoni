import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

type Props = {
  value: number;
  style?: StyleProp<TextStyle>;
  formatter?: (n: number) => string;
};

/** Count-up animation when `value` changes (profile stats). */
export default function AnimatedStatValue({
  value,
  style,
  formatter = (n) => String(Math.round(n)),
}: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let canceled = false;
    let raf = 0;
    const start = Date.now();
    const duration = 650;
    const tick = () => {
      if (canceled) return;
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      canceled = true;
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <Text style={style}>{formatter(display)}</Text>;
}
