import React from "react";
import GlassCard from "./GlassCard";

export default {
  title: "UI/GlassCard",
  component: GlassCard,
};

export const Default = () => (
  <div className="p-6">
    <GlassCard>
      <h3 className="text-lg font-semibold">Glass Card</h3>
      <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
        Reusable card container with blur, shadow and theme-aware borders.
      </p>
    </GlassCard>
  </div>
);
