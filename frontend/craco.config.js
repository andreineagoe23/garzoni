/**
 * CRACO config to tweak CRA webpack without ejecting.
 *
 * We exclude CKEditor packages from `source-map-loader` because their distributed
 * source maps reference non-existent sources (e.g. `webpack://...`, `../src/...`)
 * which can hard-fail the build on Windows with ENOENT.
 */
const path = require("path");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

// On Windows, CRA can inject absolute paths (e.g. G:\proj\node_modules\babel-loader\lib\index.js)
// which enhanced-resolve then fails to resolve. Replace with package name or package-relative path.
function toLoaderRequest(loaderPath) {
  if (!loaderPath || typeof loaderPath !== "string") return loaderPath;
  const normalized = path.normalize(loaderPath).replace(/\\/g, "/");
  const nodeModules = normalized.indexOf("node_modules");
  if (nodeModules === -1) return loaderPath;
  const after = normalized.slice(normalized.indexOf("node_modules") + "node_modules".length).replace(/^\/+/, "");
  const parts = after.split("/");
  const pkg = parts[0];
  const scoped = pkg.startsWith("@") ? parts.slice(0, 2).join("/") : pkg;
  const rest = pkg.startsWith("@") ? parts.slice(2) : parts.slice(1);
  // e.g. "html-webpack-plugin/lib/loader.js" -> keep path; "babel-loader/lib/index.js" -> "babel-loader"
  const name = scoped.replace(/^@[^/]+\//, "") || scoped;
  const isLoaderPkg = name.includes("-loader") || name === "babel-loader" || name === "source-map-loader";
  if (isLoaderPkg) return name;
  if (rest.length) return scoped + "/" + rest.join("/");
  return scoped;
}

function normalizeLoaderInUse(useEntry) {
  if (!useEntry) return;
  if (typeof useEntry === "string") {
    // string loaders are left as-is; CRA usually uses objects with .loader
    return;
  }
  if (typeof useEntry.loader === "string" && path.isAbsolute(useEntry.loader)) {
    useEntry.loader = toLoaderRequest(useEntry.loader);
  }
}

function normalizeRuleLoaders(rule) {
  if (!rule) return;
  if (rule.loader) {
    if (typeof rule.loader === "string" && path.isAbsolute(rule.loader)) {
      rule.loader = toLoaderRequest(rule.loader);
    }
  }
  const uses = rule.use ? (Array.isArray(rule.use) ? rule.use : [rule.use]) : rule.loader ? [{ loader: rule.loader }] : [];
  uses.forEach(normalizeLoaderInUse);
}

function visitRulesForLoaderNormalize(rules) {
  if (!Array.isArray(rules)) return;
  for (const rule of rules) {
    if (!rule) continue;
    normalizeRuleLoaders(rule);
    if (Array.isArray(rule.oneOf)) visitRulesForLoaderNormalize(rule.oneOf);
    if (Array.isArray(rule.rules)) visitRulesForLoaderNormalize(rule.rules);
  }
}

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable persistent cache so dev server never serves stale chunks (e.g. deleted PaymentRequired.tsx)
      webpackConfig.cache = false;

      // Remove ESLint plugin from webpack plugins to prevent build errors
      webpackConfig.plugins = webpackConfig.plugins.filter(
        (plugin) => plugin.constructor.name !== "ESLintWebpackPlugin"
      );

      // Ensure webpack context is the frontend dir (helps resolution on Windows)
      webpackConfig.context = path.resolve(__dirname);

      // Resolve loaders by name from frontend node_modules (avoids absolute-path resolution on Windows)
      webpackConfig.resolveLoader = {
        modules: [path.resolve(__dirname, "node_modules"), "node_modules"],
      };

      // Ensure webpack resolves modules: src first (for bare specifiers), then node_modules
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.modules = [
        path.resolve(__dirname, "src"),
        path.resolve(__dirname, "node_modules"),
        "node_modules",
      ];

      // Add tsconfig-paths-webpack-plugin to resolve paths from tsconfig.json
      // This enables absolute imports like "contexts/AuthContext" to work
      webpackConfig.resolve.plugins = [
        ...(webpackConfig.resolve.plugins || []),
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, "tsconfig.json"),
        }),
      ];

      const ckeditorRegex = /[\\/]node_modules[\\/]@ckeditor[\\/]/;

      const isSourceMapLoader = (useEntry) => {
        if (!useEntry) return false;
        if (typeof useEntry === "string")
          return useEntry.includes("source-map-loader");
        return (
          typeof useEntry.loader === "string" &&
          useEntry.loader.includes("source-map-loader")
        );
      };

      const maybeExcludeCkeditor = (rule) => {
        // CRA typically sets `enforce: "pre"` for source-map-loader; keep it narrow.
        if (rule?.enforce !== "pre") return;

        const uses = rule.use
          ? Array.isArray(rule.use)
            ? rule.use
            : [rule.use]
          : rule.loader
            ? [{ loader: rule.loader }]
            : [];

        if (!uses.some(isSourceMapLoader)) return;

        if (!rule.exclude) {
          rule.exclude = ckeditorRegex;
          return;
        }

        if (Array.isArray(rule.exclude)) {
          rule.exclude.push(ckeditorRegex);
          return;
        }

        rule.exclude = [rule.exclude, ckeditorRegex];
      };

      const visitRules = (rules) => {
        if (!Array.isArray(rules)) return;
        for (const rule of rules) {
          if (!rule) continue;
          maybeExcludeCkeditor(rule);
          if (Array.isArray(rule.oneOf)) visitRules(rule.oneOf);
          if (Array.isArray(rule.rules)) visitRules(rule.rules);
        }
      };

      visitRules(webpackConfig.module?.rules);

      // Normalize absolute loader paths to loader names (fixes Windows resolution)
      visitRulesForLoaderNormalize(webpackConfig.module?.rules);

      // Use Sass modern API to silence "legacy JS API" deprecation
      const sassRegex = /\.(scss|sass)$/;
      const sassModuleRegex = /\.module\.(scss|sass)$/;
      const addSassModernApi = (rules) => {
        if (!Array.isArray(rules)) return;
        for (const rule of rules) {
          if (!rule) continue;
          if (rule.oneOf) addSassModernApi(rule.oneOf);
          if (rule.rules) addSassModernApi(rule.rules);
          const testStr = rule.test?.toString?.();
          const isSassRule =
            testStr === sassRegex.toString() ||
            testStr === sassModuleRegex.toString();
          if (!isSassRule) continue;
          const uses = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : [];
          for (let i = 0; i < uses.length; i++) {
            const u = uses[i];
            const loader = typeof u === "string" ? u : u?.loader;
            if (!loader || !String(loader).includes("sass-loader")) continue;
            if (typeof u === "object" && u !== null) {
              u.options = { ...u.options, api: "modern" };
            } else {
              uses[i] = { loader: u, options: { sourceMap: true, api: "modern" } };
            }
            break;
          }
        }
      };
      addSassModernApi(webpackConfig.module?.rules);

      return webpackConfig;
    },
  },
};
