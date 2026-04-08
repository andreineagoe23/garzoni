import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import GlassButton, {
  type GlassButtonSize,
  type GlassButtonVariant,
} from "./GlassButton";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  children: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const variantMap: Record<Variant, GlassButtonVariant> = {
  primary: "active",
  secondary: "secondary",
  ghost: "ghost",
  danger: "danger",
};

const sizeMap: Record<Size, GlassButtonSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

/**
 * Semantic actions (forms, profile, lessons). Renders the same pill as `GlassButton`
 * so dashboard and flows look identical.
 */
export default function Button({
  variant = "primary",
  size = "md",
  ...rest
}: ButtonProps) {
  return (
    <GlassButton variant={variantMap[variant]} size={sizeMap[size]} {...rest} />
  );
}
