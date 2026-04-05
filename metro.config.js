const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve specific modules that might be failing due to ESM/CJS mismatches in SDK 55
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-auth-session': require.resolve('expo-auth-session'),
};

// Custom obfuscation is opt-in — it has broken Metro/Babel in dev and is easy to misconfigure.
// Set SPIN_METRO_OBFUSCATE=1 when intentionally obfuscating release bundles.
config.transformer = config.transformer || {};
if (process.env.SPIN_METRO_OBFUSCATE === '1') {
  config.transformer.babelTransformerPath = require.resolve('./metro-obfuscator-transformer');
}

module.exports = config;
