const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const coreSrc = path.join(workspaceRoot, "packages", "core", "src");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@monevo/core": coreSrc,
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
