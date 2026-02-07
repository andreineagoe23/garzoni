import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const NoFinancialAdvice = () => (
  <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
    <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className={mutedClass}>Last updated: February 7, 2026</p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          No Financial Advice Notice
        </h1>
      </header>

      <div className={contentClass}>
        <p>
          <strong>
            Monevo does not provide financial, investment, tax, or legal advice.
          </strong>
        </p>

        <h2>Regulatory position</h2>
        <ul>
          <li>
            Monevo is positioned as a financial education platform and
            information tool.
          </li>
          <li>
            Monevo is not authorised by the UK Financial Conduct Authority
            (FCA) to provide regulated investment advice.
          </li>
          <li>
            Monevo does not act as your financial adviser, investment adviser,
            broker, or fiduciary.
          </li>
          <li>
            Use of Monevo does not create an adviser-client or fiduciary
            relationship.
          </li>
        </ul>

        <h2>What you should not infer</h2>
        <ul>
          <li>
            Tool outputs, rankings, prompts, and scenarios are not personal
            recommendations.
          </li>
          <li>
            Educational workflows are not instructions to enter any trade or
            investment.
          </li>
          <li>
            Labels such as "next step" refer to learning flow, not regulated
            advice.
          </li>
        </ul>

        <h2>Professional advice</h2>
        <p>
          If you need advice tailored to your circumstances, speak to a
          qualified and appropriately regulated adviser before making financial
          decisions.
        </p>

        <h2>Related documents</h2>
        <p>
          Review the <Link to="/financial-disclaimer">Financial Disclaimer</Link>,{" "}
          <Link to="/terms-of-service">Terms of Service</Link>, and{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </GlassCard>
  </section>
);

export default NoFinancialAdvice;
