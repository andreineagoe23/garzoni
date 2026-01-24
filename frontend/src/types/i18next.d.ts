import "react-i18next";
import "i18next";

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
