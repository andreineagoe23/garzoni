// Temporary type shim until `expo-av` is installed via `npx expo install expo-av`.
// Once installed this file can be deleted.
declare module "expo-av" {
  export namespace Audio {
    function requestPermissionsAsync(): Promise<{ granted: boolean }>;
    function setAudioModeAsync(mode: Record<string, unknown>): Promise<void>;
    const RecordingOptionsPresets: { HIGH_QUALITY: RecordingOptions };
    type RecordingOptions = Record<string, unknown>;
    class Recording {
      static createAsync(
        options: RecordingOptions,
      ): Promise<{ recording: Recording }>;
      stopAndUnloadAsync(): Promise<void>;
      getURI(): string | null;
    }
    class Sound {
      static createAsync(source: { uri: string }): Promise<{ sound: Sound }>;
      playAsync(): Promise<void>;
      unloadAsync(): Promise<void>;
    }
  }
}
