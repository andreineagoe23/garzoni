import { Link } from "react-router-dom";
import Header from "components/layout/Header";
import SeoHead from "components/seo/SeoHead";

const FAQ_ITEMS = [
  {
    question: "What is Garzoni?",
    answer:
      "Garzoni is a personal finance education app for young adults. It teaches budgeting, saving, investing, debt management, credit scores, and taxes through interactive ten-minute lessons, daily streaks, and an AI-powered financial coach.",
  },
  {
    question: "How is Garzoni different from a budgeting app?",
    answer:
      "Most finance apps track your money. Garzoni teaches you how money works. It is a learning platform — think Duolingo for personal finance — that builds lasting financial literacy through spaced repetition and hands-on simulators.",
  },
  {
    question: "Is Garzoni financial advice?",
    answer:
      "No. Garzoni is a financial education app. It explains concepts and runs simulations, but it does not recommend specific products and is not a registered financial adviser.",
  },
];

export default function AboutPage() {
  return (
    <>
      <SeoHead
        title="About Garzoni — Financial Education for Young Adults"
        description="Garzoni is a personal finance education platform that teaches budgeting, saving, investing, and debt management through interactive lessons and AI coaching. Learn our mission and approach."
        canonical="https://www.garzoni.app/about"
        breadcrumbs={[
          { name: "Home", url: "https://www.garzoni.app/" },
          { name: "About", url: "https://www.garzoni.app/about" },
        ]}
        faqItems={FAQ_ITEMS}
      />
      <Header />

      <main style={{ padding: "2rem", maxWidth: 820, margin: "0 auto" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
          <Link to="/">Home</Link> › <span>About</span>
        </nav>

        <h1>About Garzoni</h1>

        <p style={{ fontSize: 18, lineHeight: 1.7 }}>
          Garzoni is a personal finance education platform built for young
          adults who were never taught how money works. We turn budgeting,
          saving, investing, credit, debt, and taxes into short, practical
          lessons you can finish in ten minutes.
        </p>

        <h2>Our mission</h2>
        <p style={{ lineHeight: 1.7 }}>
          Financial literacy is one of the highest-leverage skills a person can
          learn, yet most people leave school without it. Garzoni exists to
          close that gap — to make financial education engaging, accessible, and
          genuinely useful, not intimidating.
        </p>

        <h2>How Garzoni works</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Ten-minute lessons.</strong> Bite-sized, jargon-free lessons
            that fit into a busy day.
          </li>
          <li>
            <strong>Spaced repetition.</strong> Knowledge checks resurface
            concepts over time so what you learn actually sticks.
          </li>
          <li>
            <strong>AI-powered coaching.</strong> Garzoni's AI coach reads your
            inputs in budget, debt, and savings simulators and explains what
            changes and why, in plain language.
          </li>
          <li>
            <strong>Streaks and XP.</strong> Daily streaks and experience points
            keep you coming back and building the habit.
          </li>
        </ul>

        <h2>What you'll learn</h2>
        <p style={{ lineHeight: 1.7 }}>
          Garzoni covers the core pillars of personal finance: building a
          budget, growing savings and emergency funds, paying down debt,
          understanding credit scores, the basics of investing, and navigating
          taxes — all grounded in real-world scenarios.
        </p>

        <p style={{ marginTop: "2rem" }}>
          <Link to="/learn">Browse free lessons</Link> ·{" "}
          <Link to="/marketing">See features</Link> ·{" "}
          <Link to="/subscriptions">View pricing</Link>
        </p>

        <aside
          style={{
            marginTop: "3rem",
            padding: "1.5rem",
            border: "1px solid #2a3a4a",
            borderRadius: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Start learning for free</h2>
          <p>
            Create a free account to unlock the full learning path, quizzes,
            streaks, and Garzoni's AI financial coach.
          </p>
          <Link
            to="/register"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Create a free account
          </Link>
        </aside>
      </main>
    </>
  );
}
