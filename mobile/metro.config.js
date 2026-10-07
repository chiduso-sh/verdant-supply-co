// Metro, configured so the app can import the web project's pure modules.
//
// `lib/money.ts`, `lib/cart.ts` and `lib/geo.ts` are plain TypeScript with no
// imports at all — no React, no database, no `window`. Sharing them is how
// the two clients stay agreed on what a country list contains and how cents
// are formatted, instead of this app carrying its own drifting copy.
//
// Pricing is not shared because it is not duplicated anywhere: the server
// computes every total and the app only renders what the API returns.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const sharedLib = path.resolve(projectRoot, "..", "lib");

const config = getDefaultConfig(projectRoot);

// Metro only watches the project directory by default, so an edit to a shared
// module would not trigger a reload without this.
config.watchFolders = [sharedLib];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@shop": sharedLib,
};

// Resolve packages only from mobile/node_modules. The parent directory is a
// Next.js app with its own copy of React; hierarchical lookup would let a
// shared module pull that one in and the app would render against two Reacts.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
