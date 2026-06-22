import { AppState } from "react-native";

/** iOS blocks activating AVAudioSession while the app is inactive / backgrounded. */
export function isAppActiveForAudio(): boolean {
  return AppState.currentState === "active";
}

export function isBackgroundAudioError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /audio session could not be activated/i.test(msg) ||
    /currently in the background/i.test(msg) ||
    /EXModulesErrorDomain/i.test(msg) ||
    /Prepare encountered an error/i.test(msg)
  );
}
