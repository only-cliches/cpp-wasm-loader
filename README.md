# Minimal CPP to WASM Webpack loader
Load C/C++ source files directly into javascript with a minimal execution environment.

- No external files, compiled webassembly is saved directly into the js bundle with an array buffer.
- Super small builds with minimal execution environment, bundles start at only 1kb gzipped.
- Uses emscripten for compilation.
- Provides export for WebAssembly memory.

## Installation
1. Install Emscripten following the instructions [here](https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html).
2. Run `npm i cpp-min-wasm-loader --save-dev`.
3. Add this object to the `rules` section of your webpack build:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-wasm-loader'
	}
}
```

## Minimal Example

**add.c**
```c
#include <emscripten.h>

extern "C"
{

	EMSCRIPTEN_KEEPALIVE
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
}).catch((err) => {
	console.error(err);
})

```

## Advanced Usage

The webpack loader has several options:

```js


```

## License
MIT
