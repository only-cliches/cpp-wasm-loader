const loaderUtils = require('loader-utils');

export function loadOptions(loader)
{
  const options = loaderUtils.getOptions(loader);

  const emccPath = options.emccPath ? options.emccPath : (process.platform === 'win32' ? 'em++.bat' : 'em++');
  const emccFlags = options.emccFlags ? options.emccFlags : ['-O3'];
  const publicPath = options.publicPath ? options.publicPath : '';

  return {
    emccPath, emccFlags, publicPath
  };
}
