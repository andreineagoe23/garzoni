import React from "react";
import RewardItemGrid from "./RewardItemGrid";

function ShopItems({
  onPurchase,
  balance,
}: {
  onPurchase: () => Promise<void> | void;
  balance: number;
}) {
  return <RewardItemGrid type="shop" balance={balance} onAction={onPurchase} />;
}

export default ShopItems;
