/**
 * Monorepo Metro config: watches the repo root and resolves `@garzoni/core` from source.
 *
 * We merge Expo's default `watchFolders` / `resolver.nodeModulesPaths` with monorepo tweaks
 * so `expo-doctor` passes and we avoid duplicate React (mobile `node_modules` must resolve first).
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const coreSrc = path.join(workspaceRoot, "packages", "core", "src");
const tokensSrc = path.join(workspaceRoot, "packages", "tokens", "src");

const config = getDefaultConfig(projectRoot);

// Expo/RN can inject watcher.unstable_workerThreads; older Metro validators log warnings (expo-doctor / EAS).
if (
  config.watcher &&
  Object.prototype.hasOwnProperty.call(config.watcher, "unstable_workerThreads")
) {
  delete config.watcher.unstable_workerThreads;
}

const defaultWatchFolders = [...(config.watchFolders ?? [])];
config.watchFolders = [...new Set([...defaultWatchFolders, workspaceRoot])];

const mobileNodeModules = path.resolve(projectRoot, "node_modules");
// Single resolution root: merging Expo's default nodeModulesPaths pulled in workspace copies of
// react/react-native and broke Fabric + Expo Router context (duplicate React instances).
config.resolver.nodeModulesPaths = [mobileNodeModules];

const mobileReact = path.resolve(projectRoot, "node_modules", "react");
const mobileReactDom = path.resolve(projectRoot, "node_modules", "react-dom");
const mobileReactNative = path.resolve(
  projectRoot,
  "node_modules",
  "react-native",
);
// query-string lives inside pnpm's virtual store (.pnpm/...) which Metro can't
// SHA-1 reliably. Use a local copy of v7 (CJS) so Metro reads a real file
// inside the watched mobile project, not a symlink target outside scope.
const mobileQueryString = path.resolve(
  projectRoot,
  "src",
  "shims",
  "query-string-pkg",
);

config.resolver.extraNodeModules = {
  "@garzoni/core": coreSrc,
  "@garzoni/tokens": tokensSrc,
  react: mobileReact,
  "react-dom": mobileReactDom,
  "react-native": mobileReactNative,
  "query-string": mobileQueryString,
};

function resolveSourceFile(basePath) {
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.json`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const coreAliasRoots = {
  "services/": path.join(coreSrc, "services"),
  "constants/": path.join(coreSrc, "constants"),
  "types/": path.join(coreSrc, "types"),
  "stores/": path.join(coreSrc, "stores"),
  "utils/": path.join(coreSrc, "utils"),
  "messages/": path.join(coreSrc, "messages"),
};

// Path to the query-string v7 CJS entry via the mobile node_modules symlink.
// Use the symlink path (not realpath) so Metro keeps the file inside watched scope.
const queryStringEntry = path.join(mobileQueryString, "index.js");

/**
 * pnpm gives `@types/react` two versions (18.2.79 for mobile/web, 19.1.17 for
 * the Radix peer graph the web app pulls in). That is only a types package, but
 * it is part of react-native's peer key, so the store ends up with two physical
 * copies of react-native@0.81.5 and roughly half the dependency graph links the
 * other one.
 *
 * Both then land in the bundle, `InitializeCore` runs twice, and the second run
 * hits `Object.defineProperty(global, '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__',
 * { configurable: false })` on an already-defined property. That throws while
 * ReactFabric-dev.js is still evaluating, so `ReactFabric.default` is undefined
 * and nothing renders at all. Dev-only — release builds strip the dev tooling.
 *
 * `extraNodeModules` cannot fix it: it is a fallback, and these packages each
 * have a real `node_modules/react-native` symlink that resolves successfully.
 * So re-anchor every react-native request to the mobile project, exactly as
 * nodeModulesPaths above already does for react/react-dom.
 */
const reactNativeOrigin = path.join(
  mobileNodeModules,
  "__react-native-origin__.js",
);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native" || moduleName.startsWith("react-native/")) {
    return context.resolveRequest(
      { ...context, originModulePath: reactNativeOrigin },
      moduleName,
      platform,
    );
  }
  if (moduleName === "query-string") {
    return { type: "sourceFile", filePath: queryStringEntry };
  }
  for (const [prefix, rootDir] of Object.entries(coreAliasRoots)) {
    if (moduleName.startsWith(prefix)) {
      const rel = moduleName.slice(prefix.length);
      const filePath = resolveSourceFile(path.join(rootDir, rel));
      if (filePath) {
        return { type: "sourceFile", filePath };
      }
    }
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
