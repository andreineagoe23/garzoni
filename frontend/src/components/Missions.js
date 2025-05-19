import React, {
  useState,
  useEffect,
  useRef,
  useReducer,
  useCallback,
} from "react";
import axios from "axios";
import ProgressBar from "react-bootstrap/ProgressBar";
import { gsap } from "gsap";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

const initialState = {
  dailyMissions: [],
  weeklyMissions: [],
  virtualBalance: 0,
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "setDailyMissions":
      return { ...state, dailyMissions: action.payload };
    case "setWeeklyMissions":
      return { ...state, weeklyMissions: action.payload };
    case "setVirtualBalance":
      return { ...state, virtualBalance: action.payload };
    case "setLoading":
      return { ...state, loading: action.payload };
    case "setError":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

function CoinStack({ balance, coinUnit = 10, target = 100 }) {
  const coins = Array.from(
    { length: target / coinUnit },
    (_, i) => (i + 1) * coinUnit
  );
  const unlockedCoins = Math.floor(balance / coinUnit);

  useEffect(() => {
    const newUnlocked = Math.floor(balance / coinUnit);
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
  }, [balance, coinUnit]);

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
          Save £{coinUnit - (balance % coinUnit)} more to unlock next coin!
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
          <button onClick={onMarkRead} className="btn btn-accent">
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
  const [state, dispatch] = useReducer(reducer, initialState);
  const { getAccessToken } = useAuth();
  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFact, setCurrentFact] = useState(null);

  // Convert functions to useCallback to avoid dependency cycles
  const checkLessonMissionProgress = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/missions/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      dispatch({
        type: "setDailyMissions",
        payload: response.data.daily_missions || [],
      });
    } catch (error) {
      setErrorMessage("Failed to refresh lesson mission.");
    }
  }, [getAccessToken]);

  const fetchMissions = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/missions/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      dispatch({
        type: "setDailyMissions",
        payload: response.data.daily_missions || [],
      });
      dispatch({
        type: "setWeeklyMissions",
        payload: response.data.weekly_missions || [],
      });
    } catch (error) {
      setErrorMessage("Failed to load missions. Please try again.");
    }
  }, [getAccessToken]);

  const fetchSavingsBalance = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/savings-account/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      dispatch({ type: "setVirtualBalance", payload: response.data.balance });
    } catch (error) {
      setErrorMessage("Failed to load savings balance.");
    }
  }, [getAccessToken]);

  const loadNewFact = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setCurrentFact(response.data);
    } catch (error) {
      setCurrentFact(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchMissions();
    fetchSavingsBalance();
    loadNewFact();

    // ✅ Sync lesson-based missions in case a lesson was just completed
    const lessonMissionSync = setTimeout(() => {
      checkLessonMissionProgress();
    }, 1000);

    const intervalId = setInterval(fetchMissions, 30000);
    return () => {
      clearInterval(intervalId);
      clearTimeout(lessonMissionSync);
    };
  }, [
    fetchMissions,
    fetchSavingsBalance,
    loadNewFact,
    checkLessonMissionProgress,
  ]);

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
        { fact_id: currentFact.id },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
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
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setSavingsAmount("");
      await fetchSavingsBalance();
      await fetchMissions();
    } catch (error) {
      setErrorMessage("Failed to add savings. Please try again.");
    }
  };

  const renderMissionCard = (mission, isDaily = true) => (
    <div key={mission.id} className="mission-card">
      <div className="mission-header">
        <h5 className="fw-semibold mb-2">{mission.name}</h5>
        <p className="text-muted mb-3">{mission.description}</p>
        <ProgressBar
          now={mission.progress}
          className="mb-2"
          variant="primary"
          style={{ height: "15px" }}
          label={
            mission.goal_type === "read_fact" && !isDaily
              ? `${Math.floor(mission.progress / 20)}/5 Facts`
              : mission.goal_type === "complete_lesson"
              ? `${Math.round(mission.progress)}%`
              : `${Math.round(mission.progress)}%`
          }
        />
        <small className="d-block text-muted">
          {mission.status === "completed"
            ? "Completed! 🎉"
            : mission.goal_type === "read_fact" && isDaily
            ? "Read 1 fact to complete"
            : mission.goal_type === "read_fact"
            ? `${5 - Math.floor(mission.progress / 20)} of 5 facts remaining`
            : mission.goal_type === "complete_lesson"
            ? `${Math.round(mission.progress)}% of required lesson(s)`
            : `${Math.round(mission.progress)}% complete`}
        </small>
      </div>

      {mission.status === "completed" ? (
        <div className="completed-badge">
          <span className="btn btn-success">Completed! 🎉</span>
        </div>
      ) : (
        <>
          {mission.goal_type === "add_savings" && (
            <div className="savings-section">
              <button
                onClick={() => setShowSavingsMenu(!showSavingsMenu)}
                className="btn btn-accent"
              >
                {showSavingsMenu ? "Hide Savings Jar" : "Show Savings Jar"}
              </button>
              {showSavingsMenu && (
                <div className="savings-menu">
                  <CoinStack
                    balance={state.virtualBalance}
                    coinUnit={isDaily ? 1 : 10}
                    target={isDaily ? 10 : 100}
                  />
                  <form onSubmit={handleSavingsSubmit}>
                    <input
                      type="number"
                      value={savingsAmount}
                      onChange={(e) => setSavingsAmount(e.target.value)}
                      placeholder={
                        isDaily
                          ? "Enter amount (e.g., £1)"
                          : "Enter amount (e.g., £10)"
                      }
                      className="savings-input"
                      disabled={isDaily && mission.status === "completed"} // disable after daily save
                    />
                    <button
                      type="submit"
                      className="btn btn-accent"
                      disabled={isDaily && mission.status === "completed"}
                    >
                      {isDaily && mission.status === "completed"
                        ? "Saved Today"
                        : "Add to Savings"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {mission.goal_type === "read_fact" && isDaily && (
            <div className="fact-section">
              <FactCard fact={currentFact} onMarkRead={markFactRead} />
              {!currentFact && (
                <button onClick={loadNewFact} className="btn btn-accent">
                  ↻ Try Again
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="missions-container">
      <div className="content-wrapper">
        <h1 className="page-header-title">Daily Missions</h1>
        {errorMessage && (
          <div className="alert alert-accent">{errorMessage}</div>
        )}
        <div className="grid-cards grid-2">
          {state.dailyMissions.map((m) => renderMissionCard(m, true))}
        </div>

        <h1 className="page-header-title mt-7">Weekly Missions</h1>
        <div className="grid-cards grid-2">
          {state.weeklyMissions.map((m) => renderMissionCard(m, false))}
        </div>
      </div>
    </div>
  );
}

export default Missions;
