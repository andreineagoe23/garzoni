import React from "react";

type StatBadgeProps = {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
};

const StatBadge = ({ label, value, unit, className = "" }: StatBadgeProps) => {
  return (
    <div className={`app-stat-tile ${className}`.trim()}>
      <p className="app-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-bold text-content-primary">
        {value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
};

export default StatBadge;
