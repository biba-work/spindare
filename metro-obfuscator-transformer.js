const upstreamTransformer = require('metro-react-native-babel-transformer');
const javascriptObfuscator = require('javascript-obfuscator');

function shouldObfuscate(filename, options) {
  if (!filename) return false;
  if (options.dev) return false;
  // Metro may use forward slashes on Windows — match both separators.
  const normalized = filename.replace(/\\/g, '/');
  if (normalized.includes('/node_modules/')) return false;
  return /\.(js|jsx|ts|tsx)$/.test(filename);
}

function obfuscateCode(code, filename) {
  try {
    const obfuscationResult = javascriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: false,
      debugProtectionInterval: 0,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      rotateStringArray: true,
      rotateStringArrayThreshold: 0.8,
      selfDefending: true,
      splitStrings: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
      sourceMap: true,
      sourceMapMode: 'separate',
    });

    return {
      code: obfuscationResult.getObfuscatedCode(),
      map: obfuscationResult.getSourceMap(),
    };
  } catch (error) {
    console.warn('[metro-obfuscator] could not obfuscate:', filename, error);
    return { code };
  }
}

module.exports.transform = function (args) {
  const result = upstreamTransformer.transform(args);

  if (!shouldObfuscate(args.filename, args.options)) {
    return result;
  }

  // Expo Metro's Babel step returns `{ ast, metadata }` — there is no `code` to obfuscate here.
  if (typeof result.code !== 'string' || result.code.length === 0) {
    return result;
  }

  const obfuscated = obfuscateCode(result.code, args.filename);
  return {
    ...result,
    code: obfuscated.code,
    map: obfuscated.map || result.map,
  };
};

module.exports.transformFile = module.exports.transform;
module.exports.getCacheKey = upstreamTransformer.getCacheKey;
