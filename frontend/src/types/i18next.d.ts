import "react-i18next";
import "i18next";
import type { UseTranslationOptions, UseTranslationResponse } from "react-i18next";

// Define resources structure - using Record to avoid "Type instantiation is excessively deep" errors
// This structure tells TypeScript that useTranslation can accept namespace arguments
declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: Record<string, string>;
      dashboard: Record<string, string>;
      landing: Record<string, string>;
      auth: Record<string, string>;
      billing: Record<string, string>;
      tools: Record<string, string>;
      profile: Record<string, string>;
    };
  }

  function useTranslation(
    ns?: string | string[],
    options?: UseTranslationOptions<string>
  ): UseTranslationResponse<string, string>;
}

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: Record<string, string>;
      dashboard: Record<string, string>;
      landing: Record<string, string>;
      auth: Record<string, string>;
      billing: Record<string, string>;
      tools: Record<string, string>;
      profile: Record<string, string>;
    };
  }
}
