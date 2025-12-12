import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { GlassContainer } from "components/ui";

// We no longer need a flat links array because the footer is organized into
// sections. Each section defines its own list of links below.

function Footer() {
  const location = useLocation();
  const year = new Date().getFullYear();

  /**
   * To make the footer span the full width of the page and be more useful, we
   * break the content into sections. Each section contains a heading and
   * associated links. Additional sections can easily be added here.
   */
  const sections = [
    {
      heading: "Product",
      links: [
        { label: "Dashboard", to: "/all-topics" },
        { label: "Exercises", to: "/exercises" },
        { label: "Missions", to: "/missions" },
        { label: "Tools", to: "/tools" },
        { label: "Leaderboards", to: "/leaderboards" },
        { label: "Rewards", to: "/rewards" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", to: "/welcome" },
        { label: "Pricing", to: "/pricing" },
        { label: "FAQ", to: "/faq" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy-policy" },
        { label: "Cookie Policy", to: "/cookie-policy" },
      ],
    },
  ];

  return (
    <footer
      className="w-full px-4 pb-8"
      aria-label="Site footer"
      data-path={location.pathname}
    >
      {/*
        We use GlassContainer to provide the frosted-glass effect consistent
        with the rest of the app. The container spans the full width of the
        viewport and includes padding to separate content from the edges.
      */}
      <GlassContainer
        variant="subtle"
        className="w-full px-6 py-8 sm:px-8 sm:py-10"
      >
        <div className="mx-auto w-full grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand & tagline */}
          <div className="space-y-4 md:col-span-1">
            <span className="text-lg font-semibold uppercase tracking-[0.2em] text-[color:var(--accent,#111827)]">
              monevo
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-[color:var(--muted-text,#6b7280)]">
              Learn money skills with lessons, missions, and practice.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              <a
                href="https://www.tiktok.com/@monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on TikTok"
              >
                <FaTiktok size={18} />
              </a>
              <a
                href="https://x.com/monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on X"
              >
                <FaXTwitter size={18} />
              </a>
              <a
                href="https://www.instagram.com/monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on Instagram"
              >
                <FaInstagram size={18} />
              </a>
              <a
                href="https://www.facebook.com/monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on Facebook"
              >
                <FaFacebookF size={18} />
              </a>
              <a
                href="https://www.youtube.com/@monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on YouTube"
              >
                <FaYoutube size={18} />
              </a>
              <a
                href="https://www.linkedin.com/company/monevo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                aria-label="Monevo on LinkedIn"
              >
                <FaLinkedinIn size={18} />
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
        <div className="mt-8 border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] pt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            © {year} Monevo. All rights reserved.
          </p>
        </div>
      </GlassContainer>
    </footer>
  );
}

export default Footer;
