import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";
import ShopItems from "./ShopItems";
import DonationCauses from "./DonationCauses";
import Chatbot from "./Chatbot";

function RewardsPage() {
  const [activeTab, setActiveTab] = useState("shop");
  const [balance, setBalance] = useState(0);
  const { getAccessToken } = useAuth();

  const fetchBalance = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      setBalance(parseFloat(response.data.user_data.earned_money).toFixed(2));
    } catch (error) {
      console.error("Error fetching balance:", error);
      if (error.response?.status === 401) {
        alert("Please login to view balance");
      }
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <div className="rewards-page">
      <div className="balance-display">
        <h2>Your Balance: {balance} coins</h2>
      </div>

      <div className="tab-buttons">
        <button
          className={`tab-button ${activeTab === "shop" ? "active" : ""}`}
          onClick={() => setActiveTab("shop")}
        >
          Shop
        </button>
        <button
          className={`tab-button ${activeTab === "donate" ? "active" : ""}`}
          onClick={() => setActiveTab("donate")}
        >
          Donate
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "shop" && <ShopItems onPurchase={fetchBalance} />}
        {activeTab === "donate" && <DonationCauses onDonate={fetchBalance} />}
      </div>
      <Chatbot />
    </div>
  );
}

export default RewardsPage;
