import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ProgressBar from "react-bootstrap/ProgressBar";
import { gsap } from "gsap";
import "../styles/Missions.css";

// TO DO : FIX LESSON MISSION USER PROGRESS BAR AND READING FACTS!!!

function CoinStack({ balance }) {
  const target = 100;
  const coins = Array.from({ length: 10 }, (_, i) => (i + 1) * 10);
  const unlockedCoins = Math.floor(balance / 10);

  useEffect(() => {
    const newUnlocked = Math.floor(balance / 10);
    if (newUnlocked > 0) {
      gsap.fromTo(
        `.coin:nth-child(-n+${newUnlocked})`,
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.1,
          ease: "back.out",
        }
      );
    }
  }, [balance]);

  return (
    <div className="coin-stack">
      <div className="coin-grid">
        {coins.map((amount, index) => (
          <div
            key={amount}
            className={`coin ${index < unlockedCoins ? "unlocked" : "locked"}`}
          >
            £{amount}
            <div className="coin-label">
              {index < unlockedCoins ? "Unlocked" : "Locked"}
            </div>
          </div>
        ))}
      </div>
      {balance < target && (
        <div className="next-unlock">
          Save £{10 - (balance % 10)} more to unlock next coin!
        </div>
      )}
    </div>
  );
}

function FactCard({ fact, onMarkRead }) {
  const factRef = useRef();

  useEffect(() => {
    if (fact) {
      gsap.set(factRef.current, { opacity: 0, y: 20 });

      const animation = gsap.to(factRef.current, {
        duration: 0.8,
        opacity: 1,
        y: 0,
        ease: "power4.out",
      });

      return () => animation.kill();
    }
  }, [fact]);

  return (
    <div ref={factRef} className="fact-card" style={{ opacity: 0 }}>
      {fact ? (
        <>
          <h4 className="fact-category">{fact.category}</h4>
          <div className="fact-text">{fact.text}</div>
          <button onClick={onMarkRead} className="mark-read-btn">
            ✓ Mark as Read
          </button>
        </>
      ) : (
        <div className="no-fact-message">No new financial facts available!</div>
      )}
    </div>
  );
}

function Missions() {
  const [dailyMissions, setDailyMissions] = useState([]);
  const [weeklyMissions, setWeeklyMissions] = useState([]);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFact, setCurrentFact] = useState(null);

  useEffect(() => {
    fetchMissions();
    fetchSavingsBalance();
    loadNewFact();
    const intervalId = setInterval(fetchMissions, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const loadNewFact = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
        { withCredentials: true }
      );
      setCurrentFact(response.data);
    } catch (error) {
      setCurrentFact(null);
    }
  };

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
        { fact_id: currentFact.id },
        { withCredentials: true }
      );
      gsap.to(".fact-card", {
        duration: 0.5,
        backgroundColor: "#e8f5e9",
        onComplete: loadNewFact,
      });
      await fetchMissions();
    } catch (error) {
      setErrorMessage("Failed to mark fact as read.");
    }
  };

  const fetchMissions = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/missions/`,
        { withCredentials: true }
      );
      setDailyMissions(response.data.daily_missions || []);
      setWeeklyMissions(response.data.weekly_missions || []);
    } catch (error) {
      setErrorMessage("Failed to load missions. Please try again.");
    }
  };

  const fetchSavingsBalance = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/savings-account/`,
        { withCredentials: true }
      );
      setSavingsBalance(response.data.balance);
    } catch (error) {
      setErrorMessage("Failed to load savings balance.");
    }
  };

  const handleSavingsSubmit = async (e) => {
    e.preventDefault();
    if (isNaN(savingsAmount) || savingsAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/savings-account/`,
        { amount: parseFloat(savingsAmount) },
        { withCredentials: true }
      );
      setSavingsAmount("");
      await fetchSavingsBalance();
      await fetchMissions();
    } catch (error) {
      setErrorMessage("Failed to add savings. Please try again.");
    }
  };

  const renderMission = (mission) => (
    <div key={mission.id} className="mission-card">
      <div className="mission-header">
        <h5>{mission.name}</h5>
        <p>{mission.description}</p>
        <ProgressBar
          now={mission.progress}
          label={
            mission.goal_type === "read_fact" &&
            mission.mission_type === "weekly"
              ? `${Math.floor(mission.progress / 20)}/5 Facts`
              : `${Math.round(mission.progress)}%`
          }
        />
        {mission.goal_type === "read_fact" && (
          <p className="target-text">
            {mission.status === "completed"
              ? "Completed! 🎉"
              : mission.mission_type === "daily"
              ? "Read 1 fact to complete"
              : `${5 - Math.floor(mission.progress / 20)} of 5 facts remaining`}
          </p>
        )}
      </div>

      {mission.status === "completed" ? (
        <p className="completed-badge">Completed! 🎉</p>
      ) : (
        <>
          {mission.goal_type === "add_savings" && (
            <div className="savings-section">
              <button
                onClick={() => setShowSavingsMenu(!showSavingsMenu)}
                className="update-progress-btn"
              >
                {showSavingsMenu ? "Hide Savings Jar" : "Show Savings Jar"}
              </button>
              {showSavingsMenu && (
                <div className="savings-menu">
                  <CoinStack balance={savingsBalance} />
                  <form onSubmit={handleSavingsSubmit}>
                    <input
                      type="number"
                      value={savingsAmount}
                      onChange={(e) => setSavingsAmount(e.target.value)}
                      placeholder="Enter amount (e.g., £5)"
                      className="savings-input"
                    />
                    <button type="submit" className="add-savings-btn">
                      Add to Savings
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
          {mission.status === "completed" ? (
            <p className="completed-badge">Completed! 🎉</p>
          ) : (
            mission.goal_type === "read_fact" && (
              <div className="fact-section">
                <FactCard fact={currentFact} onMarkRead={markFactRead} />
                {!currentFact && (
                  <button onClick={loadNewFact} className="refresh-fact-btn">
                    ↻ Try Again
                  </button>
                )}
              </div>
            )
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="missions-container">
      <h2 className="missions-title">Daily Missions</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <div className="missions-list">{dailyMissions.map(renderMission)}</div>

      <h2 className="missions-title">Weekly Missions</h2>
      <div className="missions-list">{weeklyMissions.map(renderMission)}</div>
    </div>
  );
}

export default Missions;
