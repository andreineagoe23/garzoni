import React from "react";
import classNames from "classnames";

/**
 * The single page shell for the app. It owns page padding, max width and the
 * vertical rhythm between top-level sections.
 *
 * Rules (see docs/dev/spacing-contract.md):
 *  - One PageContainer per route. Do not hand-roll `min-h-screen ... px-4 py-10`.
 *  - The container owns the vertical gap. Children must not add their own
 *    `space-y-*` / `mt-*` at the outermost level, or the values stack.
 *  - Pick `gap` from the two-step scale below, never an arbitrary `gap-N`.
 */

const maxWidthMap = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

/** `stack` = 16px (dense lists of related items). `section` = 32px (page sections). */
const gapMap = {
  stack: "gap-4",
  section: "gap-8",
};

type PageContainerProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  maxWidth?: keyof typeof maxWidthMap | string;
  /**
   * `stacked` (default) — flex column using `gap`.
   * `centered` — vertically centred single block (loaders, empty states).
   * `none` — no layout at all; only for pages that manage their own grid.
   */
  layout?: "stacked" | "centered" | "none";
  gap?: keyof typeof gapMap;
  innerClassName?: string;
  className?: string;
};

function PageContainer({
  children,
  maxWidth = "5xl",
  layout = "stacked",
  gap = "section",
  innerClassName = "",
  className = "",
  ...props
}: PageContainerProps) {
  const widthClass =
    maxWidth in maxWidthMap
      ? maxWidthMap[maxWidth as keyof typeof maxWidthMap]
      : maxWidth;

  const layoutClass =
    layout === "centered"
      ? "flex h-[60vh] items-center justify-center"
      : layout === "stacked"
        ? `flex flex-col ${gapMap[gap]}`
        : "";

  return (
    <section
      className={classNames(
        "min-h-screen bg-surface-page px-4 py-10",
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
