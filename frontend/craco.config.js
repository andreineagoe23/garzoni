/**
 * CRACO config to tweak CRA webpack without ejecting.
 *
 * We exclude CKEditor packages from `source-map-loader` because their distributed
 * source maps reference non-existent sources (e.g. `webpack://...`, `../src/...`)
 * which can hard-fail the build on Windows with ENOENT.
 */
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const ckeditorRegex = /[\\/]node_modules[\\/]@ckeditor[\\/]/;

      const isSourceMapLoader = (useEntry) => {
        if (!useEntry) return false;
        if (typeof useEntry === "string") return useEntry.includes("source-map-loader");
        return typeof useEntry.loader === "string" && useEntry.loader.includes("source-map-loader");
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
      return webpackConfig;
    },
  },
};
