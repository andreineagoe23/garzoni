import { Platform } from "react-native";

type ATTStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "restricted"
  | "unsupported";

type TrackingModule = {
  getTrackingPermissionsAsync: () => Promise<{ status: ATTStatus }>;
  requestTrackingPermissionsAsync: () => Promise<{ status: ATTStatus }>;
};

function loadTrackingModule(): TrackingModule | null {
  try {
    // Lazy require so missing native module (e.g. Expo Go) doesn't crash import.
    return require("expo-tracking-transparency") as TrackingModule;
  } catch {
    return null;
  }
}

export async function requestTrackingPermissionIfNeeded(): Promise<ATTStatus> {
  if (Platform.OS !== "ios") return "unsupported";
  const mod = loadTrackingModule();
  if (!mod) return "unsupported";
  try {
    const current = await mod.getTrackingPermissionsAsync();
    if (current.status !== "undetermined") return current.status;
    const next = await mod.requestTrackingPermissionsAsync();
    return next.status;
  } catch {
    return "undetermined";
  }
}
