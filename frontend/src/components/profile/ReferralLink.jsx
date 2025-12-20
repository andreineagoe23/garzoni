import React, { useMemo, useState } from "react";
import { GlassCard } from "components/ui";

const ReferralLink = ({ referralCode }) => {
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(
    () => `${window.location.origin}/register?ref=${referralCode}`,
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

  return (
    <GlassCard padding="md" className="transition-colors">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Invite Friends
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Share your link and earn rewards when friends join.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <label
          htmlFor="referralLink"
          className="block text-xs font-medium uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]"
        >
          Your unique referral link
        </label>
        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f3f4f6)] p-4 shadow-inner shadow-black/5 sm:flex-row sm:items-center">
          <input
            id="referralLink"
            type="text"
            value={referralLink}
            readOnly
            className="w-full flex-1 truncate bg-transparent text-sm font-medium text-[color:var(--text-color,#111827)] focus:outline-none"
            aria-label="Referral link"
          />
          <button
            type="button"
            onClick={copyToClipboard}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
              copied
                ? "bg-emerald-500/10 text-emerald-400 shadow-inner shadow-emerald-500/20"
                : "bg-[color:var(--primary,#2563eb)] text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-lg hover:shadow-[color:var(--primary,#2563eb)]/40"
            }`}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </GlassCard>
  );
};

export default ReferralLink;
