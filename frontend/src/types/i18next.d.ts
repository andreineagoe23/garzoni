import "react-i18next";

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
