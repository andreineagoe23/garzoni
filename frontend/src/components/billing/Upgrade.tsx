import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const UpgradeRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/subscriptions", { replace: true });
  }, [navigate]);

  return null;
};

export default UpgradeRedirect;
