import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "components/ui";
import logo from "assets/logo/logo-light-wordmark.svg";

export default function LandingHeader({ onGetApp }: { onGetApp: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className="gzh-header">
      <div className="gzh-header__row">
        <img
          src={logo}
          alt={t("welcome.header.logoAlt")}
          className="gzh-header__logo"
        />
        <div className="gzh-header__actions">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
          >
            {t("welcome.header.logIn")}
          </GlassButton>
          <GlassButton variant="active" size="sm" onClick={onGetApp}>
            {t("welcome.header.getApp")}
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
