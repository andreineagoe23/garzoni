import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const PrivacyPolicy = () => (
  <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
    <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className={mutedClass}>Last updated: February 7, 2026</p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Privacy Policy
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Monevo is an educational platform. This page explains what personal
          data we collect, why we collect it, and your rights under UK GDPR and
          EU GDPR.
        </p>
      </header>

      <div className={contentClass}>
        <h2>1. Who we are</h2>
        <p>
          This policy applies to the Monevo web app and related services
          ("Service"). For data protection purposes, the data controller is
          Monevo, United Kingdom.
        </p>

        <h2>2. Data we collect</h2>
        <p>We collect the following categories of data:</p>
        <ul>
          <li>
            <strong>Account data:</strong> email address, username, and
            password hash.
          </li>
          <li>
            <strong>Profile and preference data:</strong> first/last name (if
            provided), onboarding responses, financial learning preferences,
            language, reminder settings, and theme settings.
          </li>
          <li>
            <strong>Learning and product usage data:</strong> lessons viewed,
            progress, streaks, missions, tool usage events, and feature
            interactions.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, device/browser type,
            operating system, approximate region, timestamps, crash/error logs,
            and security logs.
          </li>
          <li>
            <strong>Cookie and tracking data:</strong> consent choices,
            analytics identifiers, and ad/marketing event data where consent is
            given.
          </li>
          <li>
            <strong>Billing metadata:</strong> plan, subscription status, and
            Stripe subscription identifiers. We do not store your full card
            number.
          </li>
          <li>
            <strong>User-provided finance inputs:</strong> simulated portfolio
            entries and learning-tool inputs entered by you.
          </li>
        </ul>

        <h2>3. How we collect data</h2>
        <ul>
          <li>Directly from you (registration, onboarding, settings, tools).</li>
          <li>Automatically via app logs, cookies, analytics, and pixels.</li>
          <li>
            From processors that support our service (for example Stripe for
            subscription status).
          </li>
        </ul>

        <h2>4. Why we process your data and legal bases</h2>
        <ul>
          <li>
            <strong>Provide and run your account</strong> (contractual
            necessity).
          </li>
          <li>
            <strong>Deliver core product features and learning progress</strong>{" "}
            (contractual necessity).
          </li>
          <li>
            <strong>Keep the platform secure and prevent abuse</strong>
            (legitimate interests).
          </li>
          <li>
            <strong>Improve product quality and performance</strong> (legitimate
            interests).
          </li>
          <li>
            <strong>Send service communications</strong> such as account and
            billing notices (contractual necessity and legitimate interests).
          </li>
          <li>
            <strong>Send optional marketing messages</strong> (consent, where
            required).
          </li>
          <li>
            <strong>Meet legal and tax obligations</strong> (legal obligation).
          </li>
        </ul>

        <h2>5. Cookies and similar technologies</h2>
        <p>
          We use strictly necessary cookies for login/session functions and,
          when you consent, analytics and marketing cookies.
        </p>
        <p>
          You can manage consent using our cookie banner and cookie settings.
          See our <Link to="/cookie-policy">Cookie Policy</Link> for details.
        </p>

        <h2>6. Third-party processors and services</h2>
        <p>
          We use third parties to operate the service. Depending on your usage,
          these may include:
        </p>
        <ul>
          <li>Stripe (billing and subscription processing).</li>
          <li>Cookiebot (cookie consent management).</li>
          <li>Google Analytics / Google Ads tags (with consent).</li>
          <li>Amplitude (product analytics).</li>
          <li>Sentry (error monitoring).</li>
          <li>Hosting and infrastructure providers.</li>
          <li>Email and transactional messaging providers.</li>
        </ul>
        <p>
          These providers process data under contracts and only for approved
          purposes.
        </p>

        <h2>7. International transfers</h2>
        <p>
          Some providers process data outside the UK/EEA. Where this happens,
          we use appropriate safeguards (such as adequacy decisions or standard
          contractual clauses).
        </p>

        <h2>8. Data retention</h2>
        <p>
          We keep personal data only as long as needed for service delivery,
          legal obligations, dispute resolution, and security. Retention periods
          vary by data type.
        </p>

        <h2>9. Your rights</h2>
        <p>Subject to applicable law, you can request to:</p>
        <ul>
          <li>Access your personal data.</li>
          <li>Correct inaccurate data.</li>
          <li>Delete your data.</li>
          <li>Restrict or object to certain processing.</li>
          <li>Withdraw consent (where processing is based on consent).</li>
          <li>Receive a portable copy of data you provided.</li>
          <li>Lodge a complaint with your data protection authority.</li>
        </ul>

        <h2>10. Security</h2>
        <p>
          We use technical and organizational safeguards designed to protect
          personal data. No method of storage or transmission is completely
          secure.
        </p>

        <h2>11. Children</h2>
        <p>
          Monevo is not intended for children under 16. If you believe a child
          has provided personal data, contact us and we will investigate.
        </p>

        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be
          posted in the app or on our website with an updated date.
        </p>

        <h2>13. Contact us</h2>
        <p>
          Email:{" "}
          <a href="mailto:monevo.educational@gmail.com">
            monevo.educational@gmail.com
          </a>
          <br />
          Support:{" "}
          <a href="mailto:monevo.educational@gmail.com">
            monevo.educational@gmail.com
          </a>
          <br />
          Country: United Kingdom
        </p>
      </div>
    </GlassCard>
  </section>
);

export default PrivacyPolicy;
