import React from "react";
import styles from "../styles/RewardsPage.module.css";
import axios from "axios";

// Import images from assets
import CourseBundle from "../assets/CourseBundle.png";
import ToolAccess from "../assets/ToolAccess.png";
import Mentorship from "../assets/Mentorship.png";
import LearningPath from "../assets/LearningPath.png";

function ShopItems({ onPurchase }) {
  const shopItems = [
    {
      id: 1,
      title: "Premium Course Bundle",
      description: "Access to all premium courses for 1 month",
      cost: 50,
      image: CourseBundle,
    },
    {
      id: 2,
      title: "Exclusive Tool Access",
      description: "Get access to advanced financial tools",
      cost: 30,
      image: ToolAccess,
    },
    {
      id: 3,
      title: "Mentorship Session",
      description: "1-hour session with a financial expert",
      cost: 100,
      image: Mentorship,
    },
    {
      id: 4,
      title: "Custom Learning Path",
      description: "Personalized learning path creation",
      cost: 75,
      image: LearningPath,
    },
  ];

  const handlePurchase = async (rewardId) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/purchases/`,
        { reward_id: rewardId },
        { withCredentials: true }
      );
      if (response.status === 201) {
        alert("Purchase successful!");
        onPurchase();
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
                alt={item.title}
                className={`${styles.itemImage} card-img-top`}
              />
              <div className="card-body text-center">
                <h5 className="card-title">{item.title}</h5>
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
