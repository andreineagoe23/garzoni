import React from "react";

export type MetricTone =
  "default" | "brand" | "warning" | "info" | "accent" | "error";

const TONE_CLASS: Record<MetricTone, string> = {
  default: "text-content-primary",
  brand: "text-brand-primary",
  warning: "text-state-warning",
  info: "text-state-info",
  accent: "text-[color:var(--color-accent)]",
  error: "text-state-error",
};

type AnalyticsMetricTileProps = {
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  tone?: MetricTone;
};

const AnalyticsMetricTile = ({
  label,
  value,
  footer,
  tone = "default",
}: AnalyticsMetricTileProps) => (
  <div className="app-stat-tile flex flex-col gap-1">
    <p className="app-eyebrow text-content-muted">{label}</p>
    <p className={`text-3xl font-bold ${TONE_CLASS[tone]}`}>{value}</p>
    {footer ? <p className="text-xs text-content-muted">{footer}</p> : null}
  </div>
);

export default AnalyticsMetricTile;
