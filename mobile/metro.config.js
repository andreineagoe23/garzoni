/**
 * Monorepo Metro config: watches the repo root and resolves `@garzoni/core` from source.
 * `expo-doctor` may warn about watchFolders vs defaults — expected for pnpm workspace + core package.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const coreSrc = path.join(workspaceRoot, "packages", "core", "src");

const config = getDefaultConfig(projectRoot);

// Expo/RN can inject watcher.unstable_workerThreads; older Metro validators log warnings (expo-doctor / EAS).
if (
  config.watcher &&
  Object.prototype.hasOwnProperty.call(config.watcher, "unstable_workerThreads")
) {
  delete config.watcher.unstable_workerThreads;
}

config.watchFolders = [workspaceRoot];
// Only the app package's node_modules — do not add the repo root, or Metro can pick
// `react@19.2.4` from the web workspace while RN ships `react-native-renderer@19.1.0`
// (invalid hook call / duplicate React).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

const mobileReact = path.resolve(projectRoot, "node_modules", "react");
const mobileReactDom = path.resolve(projectRoot, "node_modules", "react-dom");

config.resolver.extraNodeModules = {
  "@garzoni/core": coreSrc,
  react: mobileReact,
  "react-dom": mobileReactDom,
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

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
