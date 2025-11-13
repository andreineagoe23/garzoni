import React from "react";

const GlassCard = ({
  children,
  className = "",
  hover = true,
  padding = "md",
  ...props
}) => {
  // Theme-aware border: darker in light mode, lighter in dark mode
  const borderStyle = "border-[color:var(--border-color,rgba(0,0,0,0.1))]";
  const baseStyles =
    `relative overflow-hidden rounded-3xl ${borderStyle} bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] backdrop-blur-lg transition-all`;
  
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "px-6 py-8",
    xl: "px-8 py-10",
  };

  const hoverStyles = hover
    ? "hover:shadow-xl hover:shadow-[color:var(--shadow-color,rgba(0,0,0,0.12))]"
    : "";

  const combinedClassName = `${baseStyles} ${paddingStyles[padding]} ${hoverStyles} ${className}`;

  return (
    <div
      className={combinedClassName}
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;

