import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchReferralSummary } from "@garzoni/core";
import { GlassCard } from "components/ui";

const ReferralLink = ({ referralCode }: { referralCode: string }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => (await fetchReferralSummary()).data,
    staleTime: 60_000,
  });

  const referralLink = useMemo(
    () =>
      `${window.location.origin}/welcome?ref=${encodeURIComponent(referralCode)}`,
    [referralCode]
  );

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error) => console.error("Copy failed:", error));
  };

  const invitesCount = summary?.referrals_made?.length ?? 0;
  const earnedCode = summary?.earned_discount_code;

  return (
    <GlassCard padding="md" className="transition-colors">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("profile.referral.title")}
        </h3>
        <p className="text-sm text-content-muted">
          {t("profile.referral.subtitle")}
        </p>
        {invitesCount > 0 ? (
          <p className="text-xs text-content-muted">
            {t("profile.referral.invitesSent", { count: invitesCount })}
          </p>
        ) : null}
        {earnedCode ? (
          <div className="rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--input-bg,#f3f4f6)] px-3 py-2 text-sm">
            <p className="font-medium text-content-primary">
              {t("profile.referral.earnedCode")}
            </p>
            <p className="mt-1 font-mono font-semibold">{earnedCode}</p>
            <p className="mt-1 text-xs text-content-muted">
              {t("profile.referral.redeemAtCheckout")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <label
          htmlFor="referralLink"
          className="block text-xs font-medium uppercase tracking-wide text-content-muted"
        >
          {t("profile.referral.linkLabel")}
        </label>
        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--input-bg,#f3f4f6)] p-4 shadow-inner shadow-black/5 sm:flex-row sm:items-center">
          <input
            id="referralLink"
            type="text"
            value={referralLink}
            readOnly
            className="w-full flex-1 truncate bg-transparent text-sm font-medium text-content-primary focus:outline-none"
            aria-label={t("profile.referral.linkAria")}
          />
          <button
            type="button"
            onClick={copyToClipboard}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 ${
              copied
                ? "bg-[color:var(--primary-soft,rgba(29,83,48,0.1))] text-[color:var(--accent,#ffd700)] shadow-inner shadow-[color:var(--accent,#ffd700)]/20"
                : "bg-[color:var(--color-brand-primary)] text-white shadow-md shadow-[color:var(--accent,#ffd700)]/30 hover:shadow-lg hover:shadow-[color:var(--accent,#ffd700)]/40"
            }`}
          >
            {copied
              ? t("profile.referral.copied")
              : t("profile.referral.copyLink")}
          </button>
        </div>
      </div>
    </GlassCard>
  );
};

export default ReferralLink;
