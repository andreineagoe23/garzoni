const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, host } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const apiPort = process.env.REACT_APP_BACKEND_PORT || "8000";

    if (isLocalhost) {
      return `${protocol}//${hostname}:${apiPort}/api`;
    }

    return `${protocol}//${host}/api`;
  }

  return "http://localhost:8000/api";
};

export const BACKEND_URL = getBackendUrl();
