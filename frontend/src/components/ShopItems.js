import React, { useState, useEffect } from "react";
import "../styles/scss/main.scss";
import axios from "axios";

function ShopItems({ onPurchase }) {
  const [shopItems, setShopItems] = useState([]);

  useEffect(() => {
    const fetchShopItems = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/rewards/shop/`,
          {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
        );
        setShopItems(response.data);
      } catch (error) {
        console.error("Error fetching shop items:", error);
      }
    };
    fetchShopItems();
  }, []);

  const handlePurchase = async (rewardId) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/purchases/`,
        { reward_id: rewardId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );

      if (response.status === 201) {
        alert("Purchase successful!");
        onPurchase(); // Trigger balance refresh
      }
    } catch (error) {
      console.error("Error purchasing reward:", error);
      alert(error.response?.data?.error || "Failed to purchase reward.");
    }
  };

  return (
    <div className="shop-container">
      <h2 className="text-center">Shop</h2>
      <div className="items-grid">
        {shopItems.map((item) => (
          <div key={item.id} className="item-card">
            <img src={item.image} alt={item.name} className="item-image" />
            <div className="card-body">
              <h5 className="card-title">{item.name}</h5>
              <p className="card-text">{item.description}</p>
            </div>
            <div className="card-footer">
              <span className="item-cost">{item.cost} coins</span>
              <button
                className="buy-button"
                onClick={() => handlePurchase(item.id)}
              >
                Buy Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShopItems;
