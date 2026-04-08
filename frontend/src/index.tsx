import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";

import "styles/entry";
import "i18n";
import App from "./App";
import reportWebVitals from "reportWebVitals";
import { registerServiceWorker } from "serviceWorkerRegistration";
import { trackAnalyticsEvent } from "services/analyticsClient";
import { initStartup } from "bootstrap/startup";
import { initHttpClientWeb } from "bootstrap/httpClientWeb";

initStartup();
initHttpClientWeb();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
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
