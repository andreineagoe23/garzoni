// src/components/Navbar.js
import React from "react";
import { NavLink } from "react-router-dom";
import styles from "../styles/Navbar.module.css";

function Navbar() {
  return (
    <div className={styles.navbar}>
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
  );
}

export default Navbar;
