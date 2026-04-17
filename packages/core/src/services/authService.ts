import apiClient from "./httpClient";

export const requestPasswordReset = (email: string) =>
  apiClient.post("/password-reset/", { email });

export const confirmPasswordReset = (
  uidb64: string,
  token: string,
  payload: Record<string, unknown>,
) => apiClient.post(`/password-reset-confirm/${uidb64}/${token}/`, payload);

/** Password reset via django-rest-passwordreset (token query link from email). */
export const confirmDrfPasswordReset = (token: string, password: string) =>
  apiClient.post<{ status?: string }>(
    "/auth/drf-password-reset/confirm/",
    { token, password },
    { skipAuthRedirect: true },
  );

export type LoginSecurePayload = {
  username: string;
  password: string;
  recaptcha_token?: string;
  client_type?: string;
  platform?: string;
};

/** Password login; native apps must send `client_type` / `platform` `mobile` to skip web reCAPTCHA. */
export const loginSecure = (payload: LoginSecurePayload) => {
  const body: Record<string, unknown> = {
    username: payload.username,
    password: payload.password,
  };
  if (payload.recaptcha_token != null && payload.recaptcha_token !== "") {
    body.recaptcha_token = payload.recaptcha_token;
  }
  if (payload.client_type != null && payload.client_type !== "") {
    body.client_type = payload.client_type;
  }
  if (payload.platform != null && payload.platform !== "") {
    body.platform = payload.platform;
  }
  return apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
  }>("/login-secure/", body, { skipAuthRedirect: true });
};

export const obtainTokenPair = (payload: {
  username: string;
  password: string;
}) =>
  apiClient.post<{ access: string; refresh?: string }>("/token/", payload, {
    skipAuthRedirect: true,
  });

export const registerSecure = (userData: Record<string, unknown>) =>
  apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
    next?: string;
  }>("/register-secure/", userData, { skipAuthRedirect: true });

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

export const appleVerifyIdentity = (body: {
  identity_token: string;
  state?: string;
  first_name?: string;
  last_name?: string;
}) =>
  apiClient.post<{
    access: string;
    refresh?: string;
    user: Record<string, unknown>;
    next: string;
  }>("/auth/apple/verify-identity/", body, { skipAuthRedirect: true });

export const refreshAccessToken = (refresh: string) =>
  apiClient.post<{ access: string; refresh?: string }>(
    "/token/refresh/",
    { refresh },
    { skipAuthRedirect: true },
  );

export const changePassword = (body: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}) =>
  apiClient.post<{ message?: string; error?: string }>(
    "/change-password/",
    body,
  );

/** Deletes the authenticated user. Caller should clear local session after success. */
export const deleteAccount = () =>
  apiClient.delete<{ message?: string; error?: string }>("/delete-account/", {
    skipAuthRedirect: true,
  });
