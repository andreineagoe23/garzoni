import React, { useState, useEffect } from "react";
import styles from "../styles/RewardsPage.module.css";
import axios from "axios";

function ShopItems({ onPurchase }) {
  const [shopItems, setShopItems] = useState([]);

  useEffect(() => {
    const fetchShopItems = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/rewards/shop/`,
          { withCredentials: true }
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
        { withCredentials: true }
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
    <div className={`${styles.shopContainer} container`}>
      <h2 className="text-center mb-4">Shop</h2>
      <div className="row">
        {shopItems.map((item) => (
          <div key={item.id} className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4">
            <div className={`${styles.itemCard} card shadow-sm`}>
              <img
                src={item.image}
                alt={item.name}
                className={`${styles.itemImage} card-img-top`}
              />
              <div className="card-body text-center">
                <h5 className="card-title">{item.name}</h5>
                <p className="card-text">{item.description}</p>
              </div>
              <div className="card-footer d-flex justify-content-between align-items-center">
                <span className={styles.itemCost}>{item.cost} coins</span>
                <button
                  className={`btn btn-success ${styles.buyButton}`}
                  onClick={() => handlePurchase(item.id)}
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShopItems;
