import React from "react";

type StatBadgeProps = {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
};

const StatBadge = ({ label, value, unit, className = "" }: StatBadgeProps) => {
  return (
    <div
      className={`rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm ${className}`.trim()}
    >
      <p className="text-xs uppercase tracking-wide text-content-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-content-primary">
        {value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
};

export default StatBadge;
