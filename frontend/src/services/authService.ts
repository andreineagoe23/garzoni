import apiClient from "./httpClient";

export const requestPasswordReset = (email) =>
  apiClient.post("/password-reset/", { email });

export const confirmPasswordReset = (uidb64, token, payload) =>
  apiClient.post(`/password-reset-confirm/${uidb64}/${token}/`, payload);
