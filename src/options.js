'use strict';


exports.loadOptions = loadOptions;
var loaderUtils = require('loader-utils');

function loadOptions(loader) {
  var options = loaderUtils.getOptions(loader);

  var emccPath = options.emccPath ? options.emccPath : process.platform === 'win32' ? 'em++.bat' : 'em++';
  var emccFlags = options.emccFlags ? options.emccFlags : ['-Os'];

  return {
    emccPath, emccFlags
  };
}