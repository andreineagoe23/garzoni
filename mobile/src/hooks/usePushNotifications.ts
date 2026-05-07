import { useEffect } from "react";
import { registerForPushAndSubmitToken } from "../bootstrap/pushNotificationsMobile";

export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPushAndSubmitToken();
  }, [isAuthenticated]);
}
