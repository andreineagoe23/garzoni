declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_APP_ENV?: string;
    EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_HTTP?: string;
    EXPO_PUBLIC_BACKEND_URL?: string;
    EXPO_PUBLIC_WEB_APP_URL?: string;
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?: string;
    EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?: string;
    EXPO_PUBLIC_REVENUECAT_IOS_KEY?: string;
    EAS_BUILD?: string;
  }
}
