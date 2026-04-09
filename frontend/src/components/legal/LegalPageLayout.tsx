import React from "react";
import { GlassCard } from "components/ui";

type LegalPageLayoutProps = {
  /** e.g. "Last updated: February 7, 2026" */
  lastUpdated: string;
  /** Page title (h1) */
  title: string;
  /** Optional intro/subtitle below the title */
  intro?: string;
  children: React.ReactNode;
};

/**
 * Shared layout for all legal pages (Privacy, Cookie, Terms, Financial Disclaimer).
 * Aligns with Garzoni GlassCard and theme variables; consistent spacing between header and body.
 */
export default function LegalPageLayout({
  lastUpdated,
  title,
  intro,
  children,
}: LegalPageLayoutProps) {
  return (
    <section className="legal-page-section min-h-[60vh] bg-surface-page px-4 py-8 sm:px-6 sm:py-10">
      <GlassCard
        padding="xl"
        className="mx-auto w-full max-w-4xl border-[color:var(--border-color,rgba(0,0,0,0.1))]"
        hover={false}
      >
        <header className="space-y-4 border-b border-[color:var(--border-color,rgba(0,0,0,0.08))] pb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">
            {lastUpdated}
          </p>
          <h1 className="legal-page-title text-3xl font-bold tracking-tight text-[color:var(--accent)] sm:text-4xl">
            {title}
          </h1>
          {intro && (
            <p className="max-w-3xl text-base leading-relaxed text-content-muted">
              {intro}
            </p>
          )}
        </header>

        <div
          className={[
            "legal-page-prose prose prose-slate max-w-none pt-8",
            "text-content-primary",
            "prose-h2:mt-10 prose-h2:mb-3 prose-h2:text-xl prose-h2:first:mt-0",
            "prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-lg",
            "prose-p:mb-4 prose-p:leading-relaxed",
            "prose-ul:my-4 prose-li:my-1 prose-li:leading-relaxed",
            "prose-a:text-[color:var(--primary,#2563eb)] prose-a:no-underline hover:prose-a:underline",
          ].join(" ")}
        >
          {children}
        </div>
      </GlassCard>
    </section>
  );
}
