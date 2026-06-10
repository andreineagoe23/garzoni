import { Platform } from "react-native";

/**
 * True when the iOS app is running as an iPad/iPhone app on Apple Silicon Mac
 * (Mac App Store / TestFlight "Designed for iPad" mode). Use to gate features
 * that don't work on Mac instead of opting out of Mac distribution entirely.
 */
export function isIOSAppOnMac(): boolean {
  if (Platform.OS !== "ios") return false;
  const constants = Platform.constants as {
    interfaceIdiom?: string;
    systemName?: string;
  };
  return constants.interfaceIdiom === "mac" || constants.systemName === "macOS";
}
