import React, { useState, useEffect } from "react";
import ShopItems from "./ShopItems";
import DonationCauses from "./DonationCauses";
import styles from "../styles/RewardsPage.module.css";
import axios from "axios";

function RewardsPage() {
  const [activeTab, setActiveTab] = useState("shop");
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          { withCredentials: true }
        );
        setBalance(response.data.earned_money);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };
    fetchBalance();
  }, []);

  return (
    <div className={styles.rewardsPage}>
      <div className={styles.balanceDisplay}>
        <h2>Your Balance: {balance} coins</h2>
      </div>

      <div className={styles.tabButtons}>
        <button
          className={`${styles.tabButton} ${
            activeTab === "shop" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("shop")}
        >
          Shop
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === "donate" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("donate")}
        >
          Donate
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === "shop" && (
          <ShopItems onPurchase={() => setBalance(balance - 5)} />
        )}
        {activeTab === "donate" && (
          <DonationCauses onDonate={() => setBalance(balance - 10)} />
        )}
      </div>
    </div>
  );
}

export default RewardsPage;
