const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Android 16 ignores orientation/resizability restrictions on large-screen
 * devices (foldables, tablets). Google Play flags any activity that still
 * declares them. A transitive Google Play Services dependency ships
 * `GmsBarcodeScanningDelegateActivity` locked to `screenOrientation="portrait"`.
 * We don't declare that activity ourselves, so we override the merged manifest:
 * re-declare it with `tools:node="merge"` + `tools:replace` to drop the
 * orientation lock and mark it resizeable.
 *
 * Also stamps `android:resizeableActivity="true"` on the app's own launcher
 * activity so the whole app is declared large-screen friendly.
 */

const TOOLS_NS = "http://schemas.android.com/tools";
const SCANNER_ACTIVITY =
  "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity";

function ensureToolsNamespace(manifest) {
  manifest.$ = manifest.$ || {};
  if (!manifest.$["xmlns:tools"]) {
    manifest.$["xmlns:tools"] = TOOLS_NS;
  }
}

const withLargeScreenSupport = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    ensureToolsNamespace(manifest);

    const application = manifest.application?.[0];
    if (!application) return cfg;

    // Mark the app resizeable at the <application> level.
    application.$ = application.$ || {};
    application.$["android:resizeableActivity"] = "true";

    application.activity = application.activity || [];

    const already = application.activity.some(
      (a) => a?.$?.["android:name"] === SCANNER_ACTIVITY,
    );
    if (!already) {
      application.activity.push({
        $: {
          "android:name": SCANNER_ACTIVITY,
          "android:screenOrientation": "fullSensor",
          "android:resizeableActivity": "true",
          "tools:node": "merge",
          "tools:replace":
            "android:screenOrientation,android:resizeableActivity",
        },
      });
    }

    return cfg;
  });

module.exports = withLargeScreenSupport;
