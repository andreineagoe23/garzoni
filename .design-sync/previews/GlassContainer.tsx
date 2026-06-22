import React from "react";
import { GlassContainer } from "@garzoni/web";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div data-theme="dark" style={{ background: "#0b0f14", padding: 28 }}>
    {children}
  </div>
);

const Inner = ({ label }: { label: string }) => (
  <div style={{ padding: 24 }}>
    <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--color-text-primary)" }}>
      {label}
    </h3>
    <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
      Frosted glass surface used to group dashboard content.
    </p>
  </div>
);

export const Default = () => (
  <Stage>
    <GlassContainer style={{ maxWidth: 360 }}>
      <Inner label="Default" />
    </GlassContainer>
  </Stage>
);

export const Subtle = () => (
  <Stage>
    <GlassContainer variant="subtle" style={{ maxWidth: 360 }}>
      <Inner label="Subtle" />
    </GlassContainer>
  </Stage>
);

export const Strong = () => (
  <Stage>
    <GlassContainer variant="strong" style={{ maxWidth: 360 }}>
      <Inner label="Strong" />
    </GlassContainer>
  </Stage>
);
