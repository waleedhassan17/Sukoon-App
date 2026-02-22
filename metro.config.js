const { getDefaultConfig } = require('expo/metro-config');

// Polyfill for toReversed if not available
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return this.slice().reverse();
  };
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude heavy native build directories from Metro's file watcher
// to prevent ENOSPC (inotify limit) errors on Linux
config.watcher = {
  ...config.watcher,
  additionalExts: config.watcher?.additionalExts || [],
};

// Block patterns that Metro should never crawl (native build artifacts, .cxx, gradle caches)
config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    /android\/\.cxx\/.*/,
    /android\/build\/.*/,
    /android\/app\/build\/.*/,
    /android\/\.gradle\/.*/,
    /ios\/build\/.*/,
    /ios\/Pods\/.*/,
    /\.git\/.*/,
  ],
};

module.exports = config;
