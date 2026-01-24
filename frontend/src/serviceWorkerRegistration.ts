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
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl)
      .then(() => {
        if (!isLocalhost()) return;
      })
      .catch(() => undefined);
  });
};
