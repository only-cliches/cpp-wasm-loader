'use strict';


exports.loadOptions = loadOptions;
var loaderUtils = require('loader-utils');

function loadOptions(loader) {
  var options = loaderUtils.getOptions(loader);

  var emccPath = options.emccPath ? options.emccPath : process.platform === 'win32' ? 'em++.bat' : 'em++';
  var publicPath = options.publicPath ? options.publicPath : '';

  return {
    emccPath, 
    emccFlags: options.emccFlags, 
    emitWasm: options.emitWasm,
    publicPath
  };
}