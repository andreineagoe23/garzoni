import React from "react";

const GlassContainer = ({
  children,
  className = "",
  variant = "default",
  ...props
}) => {
  // Theme-aware border: darker in light mode, lighter in dark mode
  const borderStyle = "border-[color:var(--border-color,rgba(0,0,0,0.1))]";
  const baseStyles = `rounded-3xl ${borderStyle} backdrop-blur-lg`;
  
  const variantStyles = {
    default:
      "bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]",
    subtle:
      "bg-[color:var(--card-bg,#ffffff)]/70 shadow-sm shadow-[color:var(--shadow-color,rgba(0,0,0,0.05))]",
    strong:
      "bg-[color:var(--card-bg,#ffffff)]/98 shadow-2xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.15))]",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`;

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

export default GlassContainer;

