import React, { useState } from "react";
import "../styles/scss/main.scss";

const ReferralLink = ({ referralCode }) => {
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(console.error);
  };

  return (
    <div className="referral-card">
      <div className="card-header">
        <h3 className="title">Invite Friends</h3>
        <p className="subtitle">Share your link and earn rewards when friends join</p>
      </div>
      
      <div className="referral-content">
        <div className="input-group">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="referral-input"
            aria-label="Referral link"
          />
          <button
            onClick={copyToClipboard}
            className={`copy-btn ${copied ? "copied" : ""}`}
            type="button"
          >
            {copied ? (
              <>
                <span className="check">✓</span>
                Copied!
              </>
            ) : (
              "Copy Link"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralLink;