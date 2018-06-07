# Minimal CPP to WASM Webpack loader

<div>
<a title="By Jeremy Kratz (https://github.com/isocpp/logos) [Copyrighted free use], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AISO_C%2B%2B_Logo.svg"><img height="128" alt="ISO C++ Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/ISO_C%2B%2B_Logo.svg/256px-ISO_C%2B%2B_Logo.svg.png"/></a>
<a title="By Carlos Baraza [CC0], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AWeb_Assembly_Logo.svg"><img height="128" alt="Web Assembly Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Web_Assembly_Logo.svg/512px-Web_Assembly_Logo.svg.png"/></a>
</div>

Load C/C++ source files directly into javascript with a zero bloat.

- No external files, compiled webassembly is saved directly into the js bundle.
- Super small builds with minimal execution environment, bundles start at only **1kb gzipped**.
- Uses `WebAssembly.instantiateStreaming` to bypass Chrome 4k limit for WebAssembly modules.
- Provides export for WebAssembly memory management and access.

## Installation
1. Install Emscripten following the instructions [here](https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html).
2. Run `npm i cpp-min-wasm-loader --save-dev`.
3. Add this object to the `rules` section of your webpack build:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-min-wasm-loader'
	}
}
```
4. Make sure `.c` and `.cpp` are in the webpack resolve object:
```js
resolve: {
	extensions: ['.js', ".c", ".cpp"]
}
```

A fully working example webpack config file can be found [here](https://github.com/ClickSimply/cpp-min-wasm-loader/blob/master/example/webpack.config.js).

## Minimal Example
You can also view a complete working example on github [here](https://github.com/ClickSimply/cpp-min-wasm-loader/tree/master/example).

**add.c**
```c
#include <emscripten.h>

extern "C"
{

	EMSCRIPTEN_KEEPALIVE /* <= Needed to export this function to javascript */
	int add(int a, int b)
	{
		return a + b;
	}

}
```

**add.js**
```js
const wasm = require("./add.c");
wasm.init().then((module) => {
	console.log(module.exports.add(1, 2)); // 3
	console.log(module.memory) // WebAssembly Memory Buffer object
}).catch((err) => {
	console.error(err);
})
```

## Advanced Usage / Tips

### Webpack Options
The webpack loader has several options:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-min-wasm-loader',
		options: {
			// emitWasm: true, // emit WASM file built by emscripten to the build folder
			// emccFlags: (existingFlags) => existingFlags.concat(["more", "flags", "here"]), // add or modify compiler flags
			// emccPath: "path/to/emcc", // only needed if emcc is not in PATH
		}
	}
}
```

### WebAssembly Memory
The `module.memory` export is a buffer that holds memory that is shared between javascript and webassembly.  You can read about how to use it in these [MDN docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory).

### Initialization
Emscripten normally provides a javascript file with webassembly builds that handles module loading, memory management and lots of different edge cases.  This loader omits that default javascript code entirely and uses the smallest possible subset of features, this means you may need to import additional items into the webassembly `imports` object if you're using more advanced webassembly features.

In this case, you can access the webassembly `import` object and modify it in the init object:
```js
const wasm = require("./add.c");
wasm.init((importENV) => {
	// make any changes to importENV as needed;
	return importENV;
}).then....
```

## License
MIT
