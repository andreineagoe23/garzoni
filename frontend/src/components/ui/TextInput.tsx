import React from "react";

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
};

const TextInput = ({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helperText,
  error,
}: TextInputProps) => {
  const describedBy = helperText || error ? `${id}-help` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-content-primary"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="w-full rounded-xl border border-border bg-surface-card px-4 py-2 text-sm text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-focus"
      />
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

export default TextInput;
