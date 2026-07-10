// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// The monorepo root is two levels up: apps/mobile -> apps -> <root>.
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so Metro picks up changes in `@tahkeem/shared`.
//    Append rather than assign: `expo/metro-config` seeds watchFolders with
//    entries the SDK relies on, and dropping them breaks asset resolution.
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// 2. Resolve modules from the app first, then fall back to the root store.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. pnpm hoists to the root `node_modules`; hierarchical lookup must stay on so
//    Metro can walk up into it for workspace packages and their dependencies.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
