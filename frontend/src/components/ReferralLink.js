import React, { useState } from "react";

const ReferralLink = ({ referralCode }) => {
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div className="referral-section">
      <h3>Invite Friends</h3>
      <p>Share your referral link to invite friends and earn points!</p>
      <div className="referral-link">
        <input
          type="text"
          value={referralLink}
          readOnly
          className="form-control"
        />
        <button onClick={copyToClipboard} className="btn">
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
};

export default ReferralLink;
