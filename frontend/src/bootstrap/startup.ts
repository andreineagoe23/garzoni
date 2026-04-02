import { initSentry } from "sentry";
import { initAnalytics } from "services/analyticsClient";
import { initErrorSuppression } from "bootstrap/errorSuppression";
import { applyLegacyHashRedirect } from "bootstrap/legacyHashRedirect";
import { initConsoleFilters } from "bootstrap/consoleFilters";
import { initChunkRecovery } from "bootstrap/chunkRecovery";

export const initStartup = () => {
  initErrorSuppression();
  applyLegacyHashRedirect();
  initConsoleFilters(import.meta.env.VITE_ENABLE_LOGS === "true");
  initSentry();
  initAnalytics();
  initChunkRecovery();
};
