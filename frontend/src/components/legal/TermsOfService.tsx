import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const TermsOfService = () => (
  <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
    <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className={mutedClass}>Last updated: February 7, 2026</p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Terms of Service
        </h1>
      </header>

      <div className={contentClass}>
        <h2>1. Agreement to these terms</h2>
        <p>
          By creating an account, accessing, or using Monevo, you agree to
          these Terms, our <Link to="/privacy-policy">Privacy Policy</Link>,
          and our <Link to="/cookie-policy">Cookie Policy</Link>.
        </p>

        <h2>2. What Monevo is (and is not)</h2>
        <p>
          Monevo is a financial education and decision-support platform.
          Monevo is not a financial adviser, investment adviser, broker, or
          fiduciary.
        </p>
        <p>
          See our <Link to="/financial-disclaimer">Financial Disclaimer</Link>{" "}
          and <Link to="/no-financial-advice">No Financial Advice Notice</Link>
          .
        </p>

        <h2>3. Eligibility and account security</h2>
        <p>
          You must provide accurate account information and keep your login
          credentials secure. You are responsible for activity under your
          account.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for unlawful purposes.</li>
          <li>Attempt unauthorized access to systems or accounts.</li>
          <li>Interfere with service availability or security controls.</li>
          <li>Reverse engineer or abuse platform features.</li>
        </ul>

        <h2>5. Educational content and user decisions</h2>
        <p>
          Content is provided for general educational purposes only and may be
          incomplete, simplified, delayed, or out of date. You are solely
          responsible for your financial decisions and outcomes.
        </p>

        <h2>6. Subscriptions, billing, and payments</h2>
        <p>
          Paid plans, billing intervals, and included features are displayed in
          product pricing. Payments are processed by third-party providers.
          Unless stated otherwise, subscriptions may renew automatically until
          cancelled.
        </p>

        <h2>7. Third-party services and links</h2>
        <p>
          Monevo may integrate with or link to third-party services. We are not
          responsible for third-party content, accuracy, availability, or
          practices.
        </p>

        <h2>8. Intellectual property</h2>
        <p>
          The platform, branding, and original content are owned by Monevo or
          licensors and are protected by applicable intellectual property laws.
          You receive a limited, non-exclusive, revocable license to use the
          service for personal lawful use.
        </p>

        <h2>9. Disclaimers</h2>
        <p>
          The service is provided "as is" and "as available" without warranties
          of any kind, express or implied, including fitness for a particular
          purpose, uninterrupted availability, or error-free operation.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Monevo and its affiliates are
          not liable for indirect, incidental, consequential, special, or
          punitive damages, or for loss of profits, revenue, data, investment
          gains, or business opportunities arising from use of the service.
        </p>

        <h2>11. Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless Monevo from claims, losses,
          liabilities, and expenses arising out of your misuse of the service or
          breach of these terms.
        </p>

        <h2>12. Suspension and termination</h2>
        <p>
          We may suspend or terminate access if we reasonably believe you have
          breached these terms, created security risk, or used the service
          unlawfully.
        </p>

        <h2>13. Changes to service and terms</h2>
        <p>
          We may update product features and these terms from time to time.
          Continued use after updates means you accept the revised terms.
        </p>

        <h2>14. Governing law and jurisdiction</h2>
        <p>
          These terms are governed by the laws of England and Wales. Courts of
          England and Wales will have exclusive jurisdiction, unless mandatory
          consumer law requires otherwise.
        </p>

        <h2>15. Contact</h2>
        <p>
          For terms questions:{" "}
          <a href="mailto:monevo.educational@gmail.com">
            monevo.educational@gmail.com
          </a>
        </p>
      </div>
    </GlassCard>
  </section>
);

export default TermsOfService;
