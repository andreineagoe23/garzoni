import React from "react";
import GlassButton from "./GlassButton";

const config = {
  title: "UI/GlassButton",
  component: GlassButton };

export default config;

export const Variants = () => (
  <div className="flex flex-wrap gap-3 p-6">
    <GlassButton variant="primary">Primary</GlassButton>
    <GlassButton variant="active">Active</GlassButton>
    <GlassButton variant="ghost">Ghost</GlassButton>
    <GlassButton variant="success" icon="✅">
      Success
    </GlassButton>
    <GlassButton variant="danger">Danger</GlassButton>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3 p-6">
    <GlassButton size="sm">Small</GlassButton>
    <GlassButton size="md">Medium</GlassButton>
    <GlassButton size="lg">Large</GlassButton>
    <GlassButton size="xl">Extra Large</GlassButton>
  </div>
);
