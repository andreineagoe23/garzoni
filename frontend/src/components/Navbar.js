import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import "../styles/scss/main.scss";

function Navbar({ toggleChatbot }) {
  const [showMore, setShowMore] = useState(false);
  const dropdownRef = useRef(null);
  const toggleRef = useRef(toggleChatbot);

  useEffect(() => {
    toggleRef.current = toggleChatbot;
  });

  const dropdownItems = [
    { path: "/missions", label: "Missions", icon: "🎯" },
    { path: "/tools", label: "Tools", icon: "🛠️" },
    { path: "/rewards", label: "Rewards", icon: "🎁" },
    {
      action: () => {
        console.log("Chat assistant clicked");
        toggleRef.current?.();
      },
      label: "Chat Assistant",
      icon: "💬",
    },
  ];

  const mainItems = [
    { path: "/all-topics", label: "Dashboard", icon: "🏠" },
    { path: "/leaderboards", label: "Leaderboards", icon: "🏆" },
    { path: "/exercises", label: "Exercises", icon: "💪" },
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ];

  const handleItemClick = (item) => {
    console.log("Handling item click:", item.label);
    if (typeof item.action === "function") {
      console.log("Executing action for:", item.label);
      item.action();
    } else {
      console.warn("No valid action for:", item.label);
    }
    setShowMore(false);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMore(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Toggle dropdown clicked");
    setShowMore((prevState) => !prevState);
  };

  Navbar.propTypes = {
    toggleChatbot: PropTypes.func.isRequired,
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="desktop-nav d-none d-lg-block">
        <div className="nav-brand">Monevo</div>
        <ul className="nav-menu">
          {mainItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
          {dropdownItems
            .filter((item) => item.path && item.label !== "Chat Assistant")
            .map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav d-lg-none">
        <ul className="nav-items">
          {mainItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <span className="nav-icon">{item.icon}</span>
              </NavLink>
            </li>
          ))}
          <li className="nav-item dropdown" ref={dropdownRef}>
            <button
              type="button"
              className="more-button"
              onClick={toggleDropdown}
              aria-label="Show more options"
            >
              <span className="nav-icon">⫶</span>
            </button>

            {showMore && (
              <div className="dropdown-menu">
                {dropdownItems.map((item, index) => (
                  <div
                    key={item.path ? item.path : `${item.label}-${index}`}
                    className="dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    role="button"
                  >
                    {item.path ? (
                      <NavLink to={item.path} className="dropdown-link">
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    ) : (
                      <>
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}

export default Navbar;
