'use strict';


exports.loadOptions = loadOptions;
var loaderUtils = require('loader-utils');

function loadOptions(loader) {
  var options = loaderUtils.getOptions(loader) || {};

  var emccPath = options.emccPath ? options.emccPath : process.platform === 'win32' ? 'em++.bat' : 'em++';
  var publicPath = options.publicPath ? options.publicPath : '';
  var disableMemoryClass = options.disableMemoryClass ? options.disableMemoryClass : false;

  return {
    emccPath, 
    emccFlags: options.emccFlags, 
    emitWasm: options.emitWasm,
    publicPath,
    disableMemoryClass,
    fetchFiles: options.fetchFiles,
    loadAsmjs: options.loadAsmjs,
    noWasm: options.noWasm
  };
}