import React, { createContext, useContext } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

type RecaptchaContextValue = {
  executeRecaptcha: ((action: string) => Promise<string>) | null;
};

const RecaptchaContext = createContext<RecaptchaContextValue>({
  executeRecaptcha: null,
});

/**
 * Must be rendered inside GoogleReCaptchaProvider. Provides executeRecaptcha
 * so Login/Register can run reCAPTCHA v3 without calling the hook when provider is absent.
 */
export function RecaptchaContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const value: RecaptchaContextValue = {
    executeRecaptcha: executeRecaptcha ?? null,
  };
  return (
    <RecaptchaContext.Provider value={value}>
      {children}
    </RecaptchaContext.Provider>
  );
}

export function useRecaptcha(): RecaptchaContextValue {
  return useContext(RecaptchaContext);
}
