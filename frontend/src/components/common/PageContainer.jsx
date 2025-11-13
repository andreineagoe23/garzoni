import React from "react";
import classNames from "classnames";

const maxWidthMap = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

function PageContainer({
  children,
  maxWidth = "5xl",
  layout = "stacked", // "stacked" | "centered" | "none"
  innerClassName = "",
  className = "",
  ...props
}) {
  const widthClass = maxWidthMap[maxWidth] ?? maxWidth;

  const layoutClass =
    layout === "centered"
      ? "flex h-[60vh] items-center justify-center"
      : layout === "stacked"
        ? "flex flex-col gap-8"
        : "";

  return (
    <section
      className={classNames(
        "min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10",
        className
      )}
      {...props}
    >
      <div
        className={classNames(
          "mx-auto w-full",
          widthClass,
          layoutClass,
          innerClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export default PageContainer;

