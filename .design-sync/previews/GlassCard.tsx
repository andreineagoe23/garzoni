import React from "react";
import { GlassCard } from "@garzoni/web";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div data-theme="dark" style={{ background: "#0b0f14", padding: 28 }}>
    {children}
  </div>
);

const Body = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <span
      style={{
        fontSize: 13,
        color: "var(--color-brand-primary)",
        fontWeight: 600,
      }}
    >
      Apprentice
    </span>
    <h3 style={{ margin: 0, fontSize: 18, color: "var(--color-text-primary)" }}>
      Giovanni di Maestro
    </h3>
    <p
      style={{
        margin: 0,
        fontSize: 14,
        color: "var(--color-text-muted)",
        lineHeight: 1.5,
      }}
    >
      Bound to a Venetian goldsmith in 1567 for a term of six years.
    </p>
  </div>
);

export const Default = () => (
  <Stage>
    <GlassCard padding="lg" style={{ maxWidth: 360 }}>
      <Body />
    </GlassCard>
  </Stage>
);

export const Paddings = () => (
  <Stage>
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <GlassCard padding="sm" style={{ maxWidth: 220 }}>
        <Body />
      </GlassCard>
      <GlassCard padding="xl" style={{ maxWidth: 280 }}>
        <Body />
      </GlassCard>
    </div>
  </Stage>
);

export const NoHover = () => (
  <Stage>
    <GlassCard hover={false} padding="lg" style={{ maxWidth: 360 }}>
      <Body />
    </GlassCard>
  </Stage>
);
