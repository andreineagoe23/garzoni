import React from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  helperText?: string;
  error?: string;
};

const SelectInput = ({
  id,
  label,
  value,
  onChange,
  options,
  helperText,
  error,
}: SelectInputProps) => {
  const describedBy = helperText || error ? `${id}-help` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-content-primary"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="w-full rounded-xl border border-border bg-surface-card px-4 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {(helperText || error) && (
        <p
          id={`${id}-help`}
          className={`text-xs ${error ? "text-state-error" : "text-content-muted"}`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default SelectInput;
