const loaderUtils = require('loader-utils');

export function loadOptions(loader)
{
  const options = loaderUtils.getOptions(loader);

  const buildPath = options.buildPath ? options.buildPath : undefined;
  if (buildPath === undefined)
  {
    throw new Error('You have to specify build path, where the WASM files will be stored');
  }

  const emccPath = options.emccPath ? options.emccPath : (process.platform === 'win32' ? 'em++.bat' : 'em++');
  const emccFlags = options.emccFlags ? options.emccFlags : ['-O3'];

  return {
    buildPath, emccPath, emccFlags
  };
}
