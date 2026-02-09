import React from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube } from "react-icons/fa6";
import { GlassContainer } from "components/ui";

const FaTiktokIcon = FaTiktok as React.ComponentType<{ size?: number }>;
const FaXTwitterIcon = FaXTwitter as React.ComponentType<{ size?: number }>;
const FaInstagramIcon = FaInstagram as React.ComponentType<{ size?: number }>;
const FaFacebookFIcon = FaFacebookF as React.ComponentType<{ size?: number }>;
const FaYoutubeIcon = FaYoutube as React.ComponentType<{ size?: number }>;
const FaLinkedinInIcon = FaLinkedinIn as React.ComponentType<{ size?: number }>;

const BMC_BUTTON_IMG =
  "https://img.buymeacoffee.com/button-api/?slug=monevo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&text=Buy%20me%20a%20coffee&outline_colour=000000&coffee_colour=ffffff";

// We no longer need a flat links array because the footer is organized into
// sections. Each section defines its own list of links below.

function Footer() {
  const { t } = useTranslation();
  const location = useLocation();
  const year = new Date().getFullYear();

  const sections = [
    {
      heading: t("footer.legal"),
      links: [
        { label: t("footer.privacyPolicy"), to: "/privacy-policy" },
        { label: t("footer.cookiePolicy"), to: "/cookie-policy" },
        { label: t("footer.termsConditions"), to: "/terms-of-service" },
        { label: t("footer.financialDisclaimer"), to: "/financial-disclaimer" },
        { label: t("footer.noFinancialAdviceNotice"), to: "/no-financial-advice" },
      ] },
    {
      heading: t("footer.company"),
      links: [
        { label: t("footer.about"), to: "/welcome" },
        { label: t("footer.subscriptions"), to: "/subscriptions" },
        { label: t("footer.faq"), to: "/faq" },
      ] },
    {
      heading: t("footer.product"),
      links: [
        { label: t("footer.dashboard"), to: "/all-topics" },
        { label: t("footer.exercises"), to: "/exercises" },
        { label: t("footer.missions"), to: "/missions" },
        { label: t("footer.tools"), to: "/tools" },
        { label: t("footer.leaderboards"), to: "/leaderboards" },
        { label: t("footer.rewards"), to: "/rewards" },
      ] },
  ];

  return (
    <footer
      className="w-full px-4 pb-8"
      aria-label={t("footer.ariaLabel")}
      data-path={location.pathname}
    >
      {/*
        We use GlassContainer to provide the frosted-glass effect consistent
        with the rest of the app. The container spans the full width of the
        viewport and includes padding to separate content from the edges.
      */}
      <GlassContainer
        variant="subtle"
        className="w-full px-5 py-8 sm:px-8 sm:py-10 lg:px-10"
      >
        <div className="mx-auto w-full max-w-6xl space-y-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand & tagline */}
            <div className="space-y-4 sm:col-span-2 lg:col-span-2">
              <span className="text-lg font-semibold uppercase tracking-[0.2em] text-[color:var(--accent,#111827)]">
                monevo
              </span>
              <p className="max-w-xs text-sm leading-relaxed text-[color:var(--muted-text,#6b7280)]">
                {t("footer.tagline")}
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-[color:var(--muted-text,#6b7280)]">
                {t("footer.disclaimer")}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                <a
                  href="https://www.tiktok.com/@monevo.educational"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "TikTok" })}
                >
                  <FaTiktokIcon size={18} />
                </a>
                <a
                  href="https://x.com/monevo_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "X" })}
                >
                  <FaXTwitterIcon size={18} />
                </a>
                <a
                  href="https://www.instagram.com/monevo.educational/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "Instagram" })}
                >
                  <FaInstagramIcon size={18} />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61587379603993"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "Facebook" })}
                >
                  <FaFacebookFIcon size={18} />
                </a>
                <a
                  href="https://www.youtube.com/@monevo.educational"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "YouTube" })}
                >
                  <FaYoutubeIcon size={18} />
                </a>
                <a
                  href="https://www.linkedin.com/in/monevo-educational-3594283ab/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={t("footer.monevoOn", { platform: "LinkedIn" })}
                >
                  <FaLinkedinInIcon size={18} />
                </a>
              </div>
              {/* Buy Me a Coffee - same styling as script (yellow, Cookie font, black outline) */}
              <div className="mt-4 flex items-center">
                <a
                  href="https://www.buymeacoffee.com/monevo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block transition opacity-90 hover:opacity-100"
                  aria-label={t("footer.buyMeACoffee")}
                >
                  <img
                    src={BMC_BUTTON_IMG}
                    alt={t("footer.buyMeACoffee")}
                    className="h-10 w-auto"
                  />
                </a>
              </div>
            </div>

            {/* Dynamic link sections */}
            {sections.map((section) => (
              <nav
                key={section.heading}
                aria-label={`${section.heading} navigation`}
                className="space-y-4"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {section.heading}
                </p>
                <ul className="space-y-2 text-sm">
                  {section.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          {/* Bottom bar with copyright */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] pt-4 sm:flex-row">
            <p className="text-xs text-[color:var(--muted-text,#6b7280)] text-center sm:text-left">
              {t("footer.copyright", { year })}
            </p>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)] text-center sm:text-right">
              {t("footer.infoDisclaimer")}
            </p>
          </div>
        </div>
      </GlassContainer>
    </footer>
  );
}

export default Footer;
