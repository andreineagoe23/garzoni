import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { getMediaBaseUrl } from "@monevo/core";

export type MascotType = "owl" | "bull" | "bear";

const FILES: Record<MascotType, string> = {
  owl: "monevo-owl.png",
  bull: "monevo-bull.png",
  bear: "monevo-bear.png",
};

type Props = {
  mascot: MascotType;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export default function MascotImage({ mascot, size = 72, style }: Props) {
  const base = getMediaBaseUrl();
  const uri = `${base}/media/mascots/${FILES[mascot]}`;
  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, resizeMode: "contain" }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}
