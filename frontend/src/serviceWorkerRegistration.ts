const isLocalhost = () => {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname.startsWith("127.")
  );
};

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl)
      .then(() => {
        if (!isLocalhost()) return;
      })
      .catch(() => undefined);
  });
};
