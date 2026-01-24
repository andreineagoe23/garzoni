import "react-i18next";
import i18next from "i18next";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: Record<string, any>;
      dashboard: Record<string, any>;
      landing: Record<string, any>;
      auth: Record<string, any>;
      billing: Record<string, any>;
      tools: Record<string, any>;
      profile: Record<string, any>;
    };
  }
}

// Extend i18next to allow namespace parameters
declare module "i18next" {
  interface TFunction {
    (key: string, options?: any): string;
  }
}
