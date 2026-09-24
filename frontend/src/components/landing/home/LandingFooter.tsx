import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import logo from "assets/logo/logo-light-wordmark.svg";

const LINKS = [
  { key: "about", to: "/about" },
  { key: "privacy", to: "/privacy-policy" },
  { key: "terms", to: "/terms-of-service" },
  { key: "disclaimer", to: "/financial-disclaimer" },
  { key: "contact", to: "/support" },
] as const;

export default function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="gzh-footer">
      <div className="gzh-footer__row">
        <img
          src={logo}
          alt={t("welcome.header.logoAlt")}
          className="gzh-footer__logo"
        />
        <nav
          className="gzh-footer__links"
          aria-label={t("welcome.footer.label")}
        >
          {LINKS.map((link) => (
            <Link key={link.key} to={link.to} className="gzh-footer__link">
              {t(`welcome.footer.${link.key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
