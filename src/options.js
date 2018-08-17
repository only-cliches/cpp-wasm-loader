'use strict';


exports.loadOptions = loadOptions;
var loaderUtils = require('loader-utils');

function loadOptions(loader) {
  var options = loaderUtils.getOptions(loader) || {};

  // prevent feature regression
  if (typeof options.noWasm !== "undefined") {
    options.wasm = !options.noWasm;
  }
  if (typeof options.loadAsmjs !== "undefined") {
    options.asmJs = options.loadAsmjs;
  }
  if (typeof options.disableMemoryClass !== "undefined") {
    options.memoryClass = !options.disableMemoryClass;
  }

  return {
    emccPath: typeof options.emccPath !== "undefined" ? options.emccPath : process.platform === 'win32' ? 'em++.bat' : 'em++', 
    emccFlags: options.emccFlags, 
    wasm: typeof options.wasm === "undefined" ? true : options.wasm,
    memoryClass: typeof options.memoryClass === "undefined" ? true : options.memoryClass,
    fetchFiles: typeof options.fetchFiles === "undefined" ? false : options.fetchFiles,
    asmJs: typeof options.asmJs === "undefined" ? false : options.asmJs,
    fullEnv: typeof options.fullEnv === "undefined" ? false : options.fullEnv
  };
}