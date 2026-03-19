const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro to resolve specific modules that might be failing due to ESM/CJS mismatches in SDK 55
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-auth-session': require.resolve('expo-auth-session'),
};

module.exports = config;
