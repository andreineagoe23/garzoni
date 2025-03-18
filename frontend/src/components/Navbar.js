import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../styles/scss/main.scss";

function Navbar() {
  const [showMore, setShowMore] = useState(false);
  const mainItems = [
    { path: "/all-topics", label: "Dashboard", icon: "🏠" },
    { path: "/leaderboards", label: "Leaderboards", icon: "🏆" },
    { path: "/exercises", label: "Exercises", icon: "💪" },
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ];

  const dropdownItems = [
    { path: "/missions", label: "Missions", icon: "🎯" },
    { path: "/tools", label: "Tools", icon: "🛠️" },
    { path: "/rewards", label: "Rewards", icon: "🎁" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="desktop-nav d-none d-lg-block">
        <div className="nav-brand">Monevo</div>
        <ul className="nav-menu">
          {[...mainItems, ...dropdownItems].map((item) => (
            <li key={item.path}>
              <NavLink to={item.path} className="nav-link">
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
              <NavLink to={item.path} className="nav-link">
                <span className="nav-icon">{item.icon}</span>
              </NavLink>
            </li>
          ))}
          <li className="nav-item dropdown">
            <button 
              className="nav-link"
              onClick={() => setShowMore(!showMore)}
            >
              <span className="nav-icon">⫶</span>
            </button>
            {showMore && (
              <div className="dropdown-menu">
                {dropdownItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="dropdown-item"
                    onClick={() => setShowMore(false)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
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