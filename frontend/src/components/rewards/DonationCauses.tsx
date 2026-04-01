import React from "react";
import RewardItemGrid from "./RewardItemGrid";

function DonationCauses({
  onDonate,
  balance,
}: {
  onDonate: () => Promise<void> | void;
  balance: number;
}) {
  return <RewardItemGrid type="donate" balance={balance} onAction={onDonate} />;
}

export default DonationCauses;
