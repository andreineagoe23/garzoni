import React from "react";
import { useTranslation } from "react-i18next";

export const APP_STORE_URL =
  "https://apps.apple.com/gb/app/garzoni-personal-finance/id6761790801";
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.garzoni.mobile";

export default function StoreBadges({ size = "md" }: { size?: "md" | "lg" }) {
  const { t } = useTranslation();
  const lg = size === "lg";
  const badge = `gzh-badge${lg ? " gzh-badge--lg" : ""}`;

  return (
    <div className={`gzh-badges${lg ? " gzh-badges--center" : ""}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={badge}
      >
        <svg
          className="gzh-badge__icon"
          viewBox="0 0 24 24"
          width={lg ? 30 : 28}
          height={lg ? 30 : 28}
          aria-hidden="true"
        >
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
        </svg>
        <span className="gzh-badge__text">
          <span className="gzh-badge__small">
            {t("welcome.badges.appStoreCaption")}
          </span>
          <span className="gzh-badge__big">App Store</span>
        </span>
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={badge}
      >
        <svg
          viewBox="0 0 24 24"
          width={lg ? 28 : 26}
          height={lg ? 28 : 26}
          aria-hidden="true"
        >
          <path className="gzh-badge__play-a" d="M4 2.5v19l10-9.5z" />
          <path className="gzh-badge__play-b" d="M4 2.5l13 7.4-3 2.6z" />
          <path className="gzh-badge__play-c" d="M4 21.5l13-7.4-3-2.6z" />
          <path
            className="gzh-badge__play-d"
            d="M17 9.9l3.4 1.9c.8.5.8 1.3 0 1.8L17 15.5l-3-3z"
          />
        </svg>
        <span className="gzh-badge__text">
          <span className="gzh-badge__small">
            {t("welcome.badges.playCaption")}
          </span>
          <span className="gzh-badge__big">Google Play</span>
        </span>
      </a>
    </div>
  );
}
