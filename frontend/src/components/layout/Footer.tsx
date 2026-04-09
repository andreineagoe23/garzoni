import React from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { OPEN_SETTINGS_EVENT } from "contexts/CookieConsentContext";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { GlassContainer } from "components/ui";

const FaTiktokIcon = FaTiktok as React.ComponentType<{ size?: number }>;
const FaXTwitterIcon = FaXTwitter as React.ComponentType<{ size?: number }>;
const FaInstagramIcon = FaInstagram as React.ComponentType<{ size?: number }>;
const FaFacebookFIcon = FaFacebookF as React.ComponentType<{ size?: number }>;
const FaYoutubeIcon = FaYoutube as React.ComponentType<{ size?: number }>;
const FaLinkedinInIcon = FaLinkedinIn as React.ComponentType<{ size?: number }>;

const BMC_BUTTON_IMG =
  "https://img.buymeacoffee.com/button-api/?slug=garzoni&button_colour=FFDD00&font_colour=000000&font_family=Cookie&text=Buy%20me%20a%20coffee&outline_colour=000000&coffee_colour=ffffff";

// We no longer need a flat links array because the footer is organized into
// sections. Each section defines its own list of links below.

function Footer() {
  const { t } = useTranslation();
  const location = useLocation();
  const year = new Date().getFullYear();

  const openCookieSettings = () =>
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));

  const sections = [
    {
      heading: t("footer.legal"),
      links: [
        { label: t("footer.privacyPolicy"), to: "/privacy-policy" },
        { label: t("footer.cookiePolicy"), to: "/cookie-policy" },
        { label: t("footer.cookieSettings"), openCookieSettings: true },
        { label: t("footer.termsConditions"), to: "/terms-of-service" },
        { label: t("footer.financialDisclaimer"), to: "/financial-disclaimer" },
      ],
    },
    {
      heading: t("footer.company"),
      links: [
        { label: t("footer.about"), to: "/welcome" },
        { label: t("footer.subscriptions"), to: "/subscriptions" },
        { label: t("footer.contact"), to: "/support" },
      ],
    },
    {
      heading: t("footer.product"),
      links: [
        { label: t("footer.dashboard"), to: "/all-topics" },
        { label: t("footer.exercises"), to: "/exercises" },
        { label: t("footer.missions"), to: "/missions" },
        { label: t("footer.tools"), to: "/tools" },
        { label: t("footer.support"), to: "/support" },
      ],
    },
  ];

  return (
    <footer
      className="app-footer w-full px-4 pb-8"
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
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* Brand, copy, and link columns only — same grid as before */}
          <div className="w-full">
            <div className="grid grid-cols-3 gap-4 sm:gap-8 sm:grid-cols-3 sm:items-start sm:gap-x-8 lg:grid-cols-5">
              <div className="col-span-3 space-y-4 sm:col-span-3 lg:col-span-2">
                <span className="footer-brand text-lg font-semibold uppercase tracking-[0.2em] text-[color:var(--accent,#ffd700)]">
                  Garzoni
                </span>
                <p className="footer-muted max-w-xs text-sm leading-relaxed text-content-muted">
                  {t("footer.tagline")}
                </p>
                <p className="footer-muted max-w-sm text-xs leading-relaxed text-content-muted">
                  {t("footer.disclaimer")}
                </p>
              </div>

              {sections.map((section) => (
                <nav
                  key={section.heading}
                  aria-label={`${section.heading} navigation`}
                  className="space-y-4"
                >
                  <p className="footer-heading text-sm font-semibold uppercase tracking-wide text-[color:var(--accent,#ffd700)]">
                    {section.heading}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {section.links.map((link) => (
                      <li
                        key={
                          "openCookieSettings" in link ? link.label : link.to
                        }
                      >
                        {"openCookieSettings" in link &&
                        link.openCookieSettings ? (
                          <button
                            type="button"
                            onClick={openCookieSettings}
                            className="footer-link text-left text-content-muted transition hover:text-content-primary"
                          >
                            {link.label}
                          </button>
                        ) : (
                          <Link
                            to={"to" in link ? link.to : "/"}
                            className="footer-link text-content-muted transition hover:text-content-primary"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          {/* Second section: socials + BMC. Rule sits between this and copyright below. */}
          <div>
            <div className="flex flex-col items-center justify-between gap-3 pb-4 sm:flex-row sm:items-center">
              <div className="grid w-full max-w-sm grid-cols-3 justify-items-center gap-3 sm:w-auto sm:max-w-none sm:grid-cols-6 sm:justify-items-start">
                <a
                  href="https://www.tiktok.com/@garzoni.educational"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "TikTok" })}
                >
                  <FaTiktokIcon size={18} />
                </a>
                <a
                  href="https://x.com/garzoni_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "X" })}
                >
                  <FaXTwitterIcon size={18} />
                </a>
                <a
                  href="https://www.instagram.com/garzoni.educational/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "Instagram" })}
                >
                  <FaInstagramIcon size={18} />
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61587379603993"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "Facebook" })}
                >
                  <FaFacebookFIcon size={18} />
                </a>
                <a
                  href="https://www.youtube.com/@garzoni.educational"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "YouTube" })}
                >
                  <FaYoutubeIcon size={18} />
                </a>
                <a
                  href="https://www.linkedin.com/company/garzoni"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-content-muted transition hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/35"
                  aria-label={t("footer.garzoniOn", { platform: "LinkedIn" })}
                >
                  <FaLinkedinInIcon size={18} />
                </a>
              </div>
              <div className="flex shrink-0 justify-center sm:justify-end">
                <a
                  href="https://www.buymeacoffee.com/garzoni"
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

            <div className="border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] pt-3">
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="footer-muted text-xs text-content-muted text-center sm:text-left">
                  {t("footer.copyright", { year })}
                </p>
                <p className="footer-muted text-xs text-content-muted text-center sm:text-right">
                  {t("footer.infoDisclaimer")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassContainer>
    </footer>
  );
}

export default Footer;
