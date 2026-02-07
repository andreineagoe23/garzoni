import React from "react";
import { GlassCard } from "components/ui";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const TermsOfService = () => (
  <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
    <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-3">
        <p className={mutedClass}>Last updated: February 2025</p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Terms of Service
        </h1>
      </header>

      <div className={contentClass}>
        <p>
          Welcome to Monevo. By accessing or using our service, you agree to be
          bound by these Terms of Service. Please read them carefully.
        </p>

        <h2>Acceptance of Terms</h2>
        <p>
          By creating an account or using Monevo, you agree to these terms, our
          Privacy Policy, and our Cookie Policy. If you do not agree, do not use
          the service.
        </p>

        <h2>Use of the Service</h2>
        <p>
          You agree to use Monevo only for lawful purposes and in accordance
          with these terms. You must not misuse the service, attempt to gain
          unauthorized access, or interfere with other users’ use of the
          platform.
        </p>

        <h2>Account and Subscription</h2>
        <p>
          You are responsible for keeping your account credentials secure. Paid
          subscriptions are subject to our pricing and billing terms; you may
          cancel in accordance with the instructions provided in your account
          or on our Pricing page.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us through
          the channels provided on our website or in the app.
        </p>
      </div>
    </GlassCard>
  </section>
);

export default TermsOfService;
