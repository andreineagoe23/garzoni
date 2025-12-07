import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

const AdminContext = createContext(null);

const STORAGE_KEY = "monevo:admin-mode";

export const AdminProvider = ({ children }) => {
  const { user } = useAuth();
  const [adminMode, setAdminMode] = useState(false);

  const canAdminister = Boolean(user?.is_staff || user?.is_superuser);

  useEffect(() => {
    if (!canAdminister) {
      setAdminMode(false);
      return;
    }

    const persisted = sessionStorage.getItem(
      `${STORAGE_KEY}:${user?.id || ""}`
    );
    if (persisted === "true") {
      setAdminMode(true);
    }
  }, [canAdminister, user?.id]);

  useEffect(() => {
    if (!canAdminister) {
      sessionStorage.removeItem(`${STORAGE_KEY}:${user?.id || ""}`);
      return;
    }

    sessionStorage.setItem(
      `${STORAGE_KEY}:${user?.id || ""}`,
      adminMode.toString()
    );
  }, [adminMode, canAdminister, user?.id]);

  const toggleAdminMode = useCallback(
    (value) => {
      if (!canAdminister) return;
      setAdminMode(typeof value === "boolean" ? value : (prev) => !prev);
    },
    [canAdminister]
  );

  const value = useMemo(
    () => ({ adminMode, toggleAdminMode, canAdminister }),
    [adminMode, canAdminister, toggleAdminMode]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};

export default AdminContext;
