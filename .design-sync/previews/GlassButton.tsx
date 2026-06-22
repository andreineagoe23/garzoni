import React from "react";
import { GlassButton } from "@garzoni/web";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div
    data-theme="dark"
    style={{
      background: "#0b0f14",
      padding: 28,
      display: "flex",
      gap: 14,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    {children}
  </div>
);

export const Variants = () => (
  <Stage>
    <GlassButton variant="primary">Primary</GlassButton>
    <GlassButton variant="active">Active</GlassButton>
    <GlassButton variant="success">Saved</GlassButton>
    <GlassButton variant="danger">Delete</GlassButton>
    <GlassButton variant="ghost">Ghost</GlassButton>
  </Stage>
);

export const Sizes = () => (
  <Stage>
    <GlassButton variant="active" size="sm">
      Small
    </GlassButton>
    <GlassButton variant="active" size="md">
      Medium
    </GlassButton>
    <GlassButton variant="active" size="lg">
      Large
    </GlassButton>
    <GlassButton variant="active" size="xl">
      Extra large
    </GlassButton>
  </Stage>
);

export const WithIcon = () => (
  <Stage>
    <GlassButton variant="primary" icon="★">
      Favorite
    </GlassButton>
    <GlassButton variant="active" icon="→">
      Continue
    </GlassButton>
  </Stage>
);

export const States = () => (
  <Stage>
    <GlassButton variant="active" loading>
      Saving
    </GlassButton>
    <GlassButton variant="primary" disabled>
      Disabled
    </GlassButton>
  </Stage>
);
