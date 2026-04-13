import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { mascotImageUrl } from "@garzoni/core";

export type MascotType = "owl" | "bull" | "bear";

type Props = {
  mascot: MascotType;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export default function MascotImage({ mascot, size = 72, style }: Props) {
  const pixelWidth = Math.min(512, Math.max(64, Math.round(size * 3)));
  const uri = mascotImageUrl(mascot, { width: pixelWidth });
  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, resizeMode: "contain" }, style]}
      accessibilityIgnoresInvertColors
    />
  );
}
