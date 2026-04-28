import React from "react";
import { useTranslation } from "react-i18next";

type DashboardHeaderProps = {
  displayName?: string;
  canAdminister?: boolean;
  adminMode?: boolean;
  toggleAdminMode?: () => void;
};

const DashboardHeader = ({
  displayName,
  canAdminister,
  adminMode,
  toggleAdminMode,
}: DashboardHeaderProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="app-icon-tile h-12 w-12 rounded-2xl text-2xl shadow-lg shadow-[color:var(--color-brand-primary,var(--primary,#1d5330))]/30">
          👋
        </div>
        <div className="flex-1">
          <p className="app-eyebrow mb-1">
            {t("dashboard.header.yourCoachSubtitle")}
          </p>
          <h2 className="app-display text-3xl text-content-primary">
            {displayName ? (
              <>
                {t("dashboard.header.welcomeBack")},{" "}
                <em className="app-em-gold">{displayName}</em>!
              </>
            ) : (
              `${t("dashboard.header.welcomeBack")}!`
            )}
          </h2>
        </div>
      </div>
      {canAdminister && (
        <button
          type="button"
          onClick={() => toggleAdminMode?.()}
          aria-pressed={adminMode}
          className={`relative z-10 inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 ${
            adminMode
              ? "border-[color:var(--color-brand-primary,var(--primary,#1d5330))] bg-[color:var(--color-brand-primary,var(--primary,#1d5330))] text-[color:var(--nav-pill-active-fg,#ffffff)] shadow"
              : "border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 text-[color:var(--color-text-muted,var(--muted-text,#6b7280))] hover:border-[color:var(--color-brand-primary,var(--primary,#1d5330))]/60 hover:text-[color:var(--color-brand-primary,var(--primary,#1d5330))]"
          } focus:ring-[color:var(--color-ring-focus,var(--primary,#1d5330))]/40 touch-manipulation`}
        >
          {adminMode
            ? t("dashboard.header.adminMode")
            : t("dashboard.header.enableAdmin")}
        </button>
      )}
    </div>
  );
};

export default DashboardHeader;
