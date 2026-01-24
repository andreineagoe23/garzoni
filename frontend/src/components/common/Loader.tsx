// components/Loader.js
import React from "react";

const Loader = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
    <div className="relative flex h-12 w-12 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent,#2563eb)]/40" />
      <span className="relative inline-flex h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
    </div>
    <p className="text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
      {message}
    </p>
  </div>
);

export default Loader;
