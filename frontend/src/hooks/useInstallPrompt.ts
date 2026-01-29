import { useCallback, useEffect, useState } from "react";

export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      // Don't prevent default - let browser handle install prompt naturally
      // This avoids the console warning
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
    // If event was prevented, we need to call prompt()
    // Otherwise browser handles it automatically
    if (promptEvent.prompt) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      return choice;
    }
    return null;
  }, [promptEvent]);

  return {
    canInstall: Boolean(promptEvent) && !isInstalled,
    promptInstall,
    isInstalled,
  };
};
