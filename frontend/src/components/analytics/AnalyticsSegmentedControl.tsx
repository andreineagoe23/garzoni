import React from "react";
import { GlassButton } from "components/ui";

type Option<T extends string | number> = {
  value: T;
  label: string;
};

type AnalyticsSegmentedControlProps<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

function AnalyticsSegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: AnalyticsSegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-surface-card/60 p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <GlassButton
            key={String(opt.value)}
            type="button"
            size="sm"
            variant={active ? "active" : "ghost"}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              active ? "!shadow-md" : "!border-transparent !bg-transparent"
            }
          >
            {opt.label}
          </GlassButton>
        );
      })}
    </div>
  );
}

export default AnalyticsSegmentedControl;
