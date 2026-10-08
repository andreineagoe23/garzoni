import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { detectMobileOs } from "utils/storeLinks";
import StoreBadges from "./StoreBadges";

export default function DownloadBand({ id }: { id: string }) {
  const { t } = useTranslation();
  const onPhone = detectMobileOs() !== null;

  return (
    <section id={id} className="gzh-download">
      <div className="gzh-download__inner gzh-rise gzh-rise--35">
        <h2 className="gzh-h2 gzh-h2--download">
          <Trans
            i18nKey="welcome.download.title"
            components={{
              accent: <span key="accent" className="gzh-accent" />,
            }}
          />
        </h2>
        <p className="gzh-sub">{t("welcome.download.body")}</p>
        <StoreBadges size="lg" placement="download_band" />
        <span className="gzh-download__note">
          {t("welcome.download.disclaimer")}
        </span>
        {/* Desktop only: scan to get the app. The white square baked into the SVG
            keeps it scannable in dark mode. */}
        {!onPhone && (
          <img
            src="/qr-get-app.svg"
            alt={t("welcome.hero.qrAlt")}
            width={96}
            height={96}
            className="rounded-card"
            loading="lazy"
          />
        )}
      </div>
    </section>
  );
}
