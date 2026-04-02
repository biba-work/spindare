const upstreamTransformer = require('metro-react-native-babel-transformer');
const javascriptObfuscator = require('javascript-obfuscator');

function shouldObfuscate(filename, options) {
  if (!filename) return false;
  if (options.dev) return false;
  if (filename.includes(`${require('path').sep}node_modules${require('path').sep}`)) return false;
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
      debugProtection: true,
      debugProtectionInterval: true,
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

module.exports.transform = function ({ src, filename, options }) {
  const result = upstreamTransformer.transform({ src, filename, options });

  if (!shouldObfuscate(filename, options)) {
    return result;
  }

  const obfuscated = obfuscateCode(result.code, filename);
  return {
    ...result,
    code: obfuscated.code,
    map: obfuscated.map || result.map,
  };
};
