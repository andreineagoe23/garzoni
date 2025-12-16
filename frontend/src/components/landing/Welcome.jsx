import React from "react";
import { useNavigate } from "react-router-dom";
import { Robot, Compass, Trophy } from "react-bootstrap-icons";
import Header from "components/layout/Header";
import { GlassCard, GlassButton } from "components/ui";
import logo from "assets/logo/monevo-logo-png.png";
import mockup1 from "assets/mobile-1.png";
import mockup2 from "assets/mobile-2.png";
import mockup3 from "assets/mobile-3.png";

const featureSections = [
  {
    icon: <Robot size={56} className="text-[color:var(--primary,#1d5330)]" />,
    title: "AI Finance Assistant",
    text: "24/7 chatbot with real-time market data & personalized advice",
    mockup: mockup1,
  },
  {
    icon: <Compass size={56} className="text-[color:var(--primary,#1d5330)]" />,
    title: "Personalized Learning Paths",
    text: "Custom curriculum based on your goals and skill level",
    mockup: mockup2,
  },
  {
    icon: <Trophy size={56} className="text-[color:var(--primary,#1d5330)]" />,
    title: "Gamified Learning",
    text: "Earn badges, points, and climb leaderboards",
    mockup: mockup3,
  },
];

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="app-container min-h-screen flex flex-col bg-[color:var(--bg-color,#ffffff)] text-[color:var(--text-color,#111827)]">
      <Header />

      <main className="relative flex-1 pt-[90px]">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-[color:var(--primary,#1d5330)]/15 to-transparent blur-3xl" />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 lg:px-8">
          <section className="flex flex-col items-center text-center">
            <img
              src={logo}
              alt="Monevo logo"
              className="mb-8 h-32 w-auto sm:h-40 md:h-48"
              loading="lazy"
            />

            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-[color:var(--text-color,#111827)] sm:text-4xl lg:text-5xl">
              Master Your Finances — The Smart Way!
            </h1>

            <p className="mt-4 max-w-2xl text-base text-[color:var(--muted-text,#6b7280)] sm:text-lg">
              Learn, practice, and grow with guided learning paths, interactive
              tools, and a supportive community ready to elevate your financial
              confidence.
            </p>

            <div className="mt-10 grid w-full max-w-md gap-4">
              <GlassButton
                type="button"
                onClick={() => navigate("/register")}
                variant="primary"
                className="w-full"
              >
                Start Free Journey
              </GlassButton>

              <GlassButton
                type="button"
                onClick={() => navigate("/login")}
                variant="ghost"
                className="w-full"
              >
                Already Signed Up?
              </GlassButton>
            </div>
          </section>

          {featureSections.map((feature, index) => (
            <GlassCard key={feature.title} padding="lg" className="p-6 lg:p-12">
              <div
                className={`flex flex-col gap-10 lg:flex-row ${
                  index % 2 !== 0 ? "lg:flex-row-reverse" : ""
                }`}
              >
                <div className="flex w-full flex-col justify-center gap-6 lg:w-1/2">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)]/10">
                    {feature.icon}
                  </div>
                  <h2 className="text-3xl font-bold text-[color:var(--text-color,#111827)] lg:text-4xl">
                    {feature.title}
                  </h2>
                  <p className="text-base text-[color:var(--muted-text,#6b7280)] lg:text-lg">
                    {feature.text}
                  </p>
                  <ul className="space-y-2 text-sm text-[color:var(--text-color,#111827)]">
                    <li>✓ Real-time market insights</li>
                    <li>✓ Interactive exercises</li>
                    <li>✓ Progress tracking</li>
                  </ul>
                </div>

                <div className="w-full lg:w-1/2">
                  <div className="relative overflow-hidden rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f3f4f6)] p-4 shadow-lg shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]">
                    <div className="absolute -right-10 top-10 h-32 w-32 rounded-full bg-[color:var(--primary,#1d5330)]/10 blur-3xl" />
                    <img
                      src={feature.mockup}
                      alt={feature.title}
                      className="relative z-[1] w-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}

          <GlassCard padding="lg" className="p-10 text-center">
            <h3 className="text-2xl font-bold text-[color:var(--text-color,#111827)] sm:text-3xl">
              Start learning free today
            </h3>
            <p className="mt-3 text-sm text-[color:var(--muted-text,#6b7280)] sm:text-base">
              Join our community of smart learners — no credit card required.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <GlassButton
                type="button"
                onClick={() => navigate("/register")}
                variant="primary"
              >
                Start Learning
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => navigate("/login")}
                variant="ghost"
              >
                Preview Dashboard
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}

export default Welcome;
