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