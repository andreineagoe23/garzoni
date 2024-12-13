import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "../styles/Navbar.module.css";
import burgerMenu from "../assets/burgermenu.svg";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <div>
      <button className={styles.burgerMenu} onClick={toggleMenu}>
        <img src={burgerMenu} alt="Menu" />
      </button>

      {/* Sidebar Navbar */}
      <div
        className={`${styles.navbar} ${menuOpen ? styles.show : ""}`}
        onClick={() => setMenuOpen(false)}
      >
        <div className={styles.logo}>monevo</div>
        <nav>
          <ul className={styles.navLinks}>
            <li>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Home
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/leaderboards"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Leaderboards
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/missions"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Missions
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/tools"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Tools
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Profile
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? styles.active : "")}
              >
                Settings
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default Navbar;
