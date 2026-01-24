import { useCallback, useEffect, useState } from "react";

export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    return choice;
  }, [promptEvent]);

  return {
    canInstall: Boolean(promptEvent) && !isInstalled,
    promptInstall,
    isInstalled,
  };
};
