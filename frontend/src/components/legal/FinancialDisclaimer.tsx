import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const FinancialDisclaimer = () => (
  <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
    <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className={mutedClass}>Last updated: February 7, 2026</p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Financial Disclaimer
        </h1>
      </header>

      <div className={contentClass}>
        <p>
          Monevo content is for <strong>educational and informational</strong>{" "}
          purposes only.
        </p>

        <h2>What this means</h2>
        <ul>
          <li>
            Content is general information and not tailored to your personal
            circumstances.
          </li>
          <li>
            We do not consider your full financial situation, risk tolerance,
            time horizon, or investment objectives.
          </li>
          <li>
            Nothing on Monevo is a recommendation or solicitation to buy, sell,
            hold, or invest in any asset.
          </li>
          <li>
            Examples, scenarios, or tool outputs are illustrative and may use
            assumptions that do not match real-world outcomes.
          </li>
          <li>
            Past performance, historical data, and model outputs do not
            guarantee future results.
          </li>
        </ul>

        <h2>Your responsibility</h2>
        <p>
          You remain fully responsible for your own financial and investment
          decisions. Before acting, consider getting advice from a qualified,
          regulated professional.
        </p>

        <h2>No warranty on accuracy or completeness</h2>
        <p>
          We aim to provide useful and current educational content, but we do
          not guarantee that all content is complete, accurate, or up to date at
          all times.
        </p>

        <h2>Related notices</h2>
        <p>
          Please also review our <Link to="/no-financial-advice">No Financial Advice Notice</Link>,{" "}
          <Link to="/terms-of-service">Terms of Service</Link>, and{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </GlassCard>
  </section>
);

export default FinancialDisclaimer;
