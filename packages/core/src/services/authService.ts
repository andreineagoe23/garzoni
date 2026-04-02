import apiClient from "./httpClient";

export const requestPasswordReset = (email: string) =>
  apiClient.post("/password-reset/", { email });

export const confirmPasswordReset = (
  uidb64: string,
  token: string,
  payload: Record<string, unknown>
) => apiClient.post(`/password-reset-confirm/${uidb64}/${token}/`, payload);

export type LoginSecurePayload = {
  username: string;
  password: string;
  recaptcha_token?: string;
  client_type?: string;
  platform?: string;
};

/** Password login; native apps should send `client_type` / `platform` `mobile` to skip web reCAPTCHA. */
export const loginSecure = (payload: LoginSecurePayload) =>
  apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
  }>(
    "/login-secure/",
    {
      username: payload.username,
      password: payload.password,
      recaptcha_token: payload.recaptcha_token,
      client_type: payload.client_type ?? "mobile",
      platform: payload.platform ?? "mobile",
    },
    { skipAuthRedirect: true }
  );

export const registerSecure = (userData: Record<string, unknown>) =>
  apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
    next?: string;
  }>(
    "/register-secure/",
    {
      ...userData,
      client_type: "mobile",
      platform: "mobile",
    },
    { skipAuthRedirect: true }
  );

export const googleVerifyCredential = (body: {
  credential: string;
  state?: string;
}) =>
  apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
    next: string;
  }>("/auth/google/verify-credential/", body, { skipAuthRedirect: true });

export const refreshAccessToken = (refresh: string) =>
  apiClient.post<{ access: string; refresh?: string }>(
    "/token/refresh/",
    { refresh },
    { skipAuthRedirect: true }
  );
