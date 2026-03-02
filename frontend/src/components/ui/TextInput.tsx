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
      <label htmlFor={id} className="text-sm font-semibold text-white/90">
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
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/50"
      />
      {(helperText || error) && (
        <p
          id={`${id}-help`}
          className={`text-xs ${error ? "text-red-300" : "text-white/60"}`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default TextInput;
