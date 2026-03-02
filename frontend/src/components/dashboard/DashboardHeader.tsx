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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 text-2xl shadow-lg shadow-[color:var(--primary,#1d5330)]/30">
          👋
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {displayName
              ? t("dashboard.header.welcomeBackName", { name: displayName })
              : `${t("dashboard.header.welcomeBack")}!`}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("dashboard.header.yourCoachSubtitle")}
          </p>
        </div>
      </div>
      {canAdminister && (
        <button
          type="button"
          onClick={() => toggleAdminMode?.()}
          aria-pressed={adminMode}
          className={`relative z-10 inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 ${
            adminMode
              ? "border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)] text-white shadow"
              : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)]"
          } focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation`}
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
