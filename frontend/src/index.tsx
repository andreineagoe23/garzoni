import React from "react";
import ReactDOM from "react-dom/client";

import "styles/entry";
import "i18n";
import App from "./App";
import reportWebVitals from "reportWebVitals";
import { registerServiceWorker } from "serviceWorkerRegistration";
import { trackAnalyticsEvent } from "services/analyticsClient";
import { initStartup } from "bootstrap/startup";

initStartup();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals((metric) => {
  trackAnalyticsEvent("web_vital", {
    name: metric.name,
    value: metric.value,
    id: metric.id,
  });
});

registerServiceWorker();
