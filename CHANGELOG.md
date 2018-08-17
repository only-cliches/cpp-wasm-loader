# 0.8.1 8/16/2018
- The C file is no longer copied to a temporary directory, allowing it to reference other files in the project.

# 0.8.0 8/16/2018
- Readme updates.
- Now supports emscripten complete environments.  They take up WAY more space but provide complete feature support.  The feature is enabled with the new config option `fullEnv`.
- Changed config options to make more sense: 
1. `noWasm` is now `wasm` and works the opposite of before.
2. `loadAsmjs` is now `asmjs` and works just as before.
3. `disableMemoryClass` is now `memoryClass` and works the opposite of before.

# 0.7.9 - 8/12/2018
- Fixed an issue with loader options.

# 0.7.8 - 8/12/2018
- Added `raw` property to promise result, contains the complete returned value from the webassembly initialization.
- Added `asm.js` support.  You can now optionally include asm.js code in the bundle that will be loaded in the place of webassembly if webassembly isn't available.  Allows native code to work back to IE10.
- Added a `noWasm` option to omit Webassembly from builds entirely.
- Changed `externalWasm` option to `fetchFiles`, works on both `asmjs` and `wasm` code now.

# 0.7.7 - 8/10/2018
- A few small bugfixes.
- Added README stuff.

# 0.7.6 - 8/9/2018
- Added fallback to `instantiate` if `instantiateStreaming` isn't available.
- Removed more code if `disableMemoryClass` is enabled.
- Added `externalWasm` option to allow switching between embedding the wasm into javascript or delivering it separately.

# 0.7.5 - 8/8/2018
- Added `struct` ability to memory class.
- Added `disableMemoryClass` option to webpack config.

# 0.7.2 - 8/7/2018
- Restored `publicPath` option.
- Added MIT license text to README.
- Fixed build error.
- EMCC flags are adjusted based on webpack production/development mode.

# 0.7.1 - 8/7/2018
- Updated Readme to reflect new package location.

# 0.7.0 - 8/7/2018
- Started changelog.
- Merged cpp-min-wasm-loader into this project.
- Added code to prevent feature regression.