# Minimal CPP to WASM Webpack Loader

<div>
<a title="By Carlos Baraza [CC0], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AWeb_Assembly_Logo.svg"><img height="128" alt="Web Assembly Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Web_Assembly_Logo.svg/512px-Web_Assembly_Logo.svg.png"/></a>
<a title="By Jeremy Kratz (https://github.com/isocpp/logos) [Copyrighted free use], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AISO_C%2B%2B_Logo.svg"><img height="128" alt="ISO C++ Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/ISO_C%2B%2B_Logo.svg/256px-ISO_C%2B%2B_Logo.svg.png"/></a>
</div>

[![NPM](https://nodei.co/npm/cpp-min-wasm-loader.png?downloads=true&stars=true)](https://nodei.co/npm/cpp-min-wasm-loader/)

Load C/C++ source files directly into javascript with a zero bloat.

- No external files, compiled webassembly is saved directly into the js bundle.
- Super small builds with minimal execution environment, bundles start at only **1.5kb gzipped**.
- Uses `WebAssembly.instantiateStreaming` to bypass Chrome 4k limit for WebAssembly modules.
- Provides export for WebAssembly memory management and access.
- Includes a small memory manager class to handle `malloc` and `free` on the javascript side (saves ~6KB).

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
	console.log(module.memoryManager) // Memory Manager Class
}).catch((err) => {
	console.error(err);
})
```

## Using The Memory Manager Class
The memory management class is only useful for handling 32 bit floating point variables.  Every variable allocated by the memory manager class will be a 32 bit floating point number.

It can provide a list of available memory addresses upon request.  The memory addresses can be used to set or access the value of that variable in javascript or C/C++;

Memory can only be allocated or freed up with the javascript API.  Values can be read or adjusted by C/C++ or Javascript using the provided memory addresses.

### Memory Manager API
To access the memory manager you can grab it off the module object after webassembly has initialized:
```js
const wasm = require("./add.c");
wasm.init().then((module) => {
	const memory = module.memoryManager;

	// get 20 available addresses.
	const addr = memory.malloc(20); 

	// set the first address to 50
	memory.set(addr[0], 50);

	// get the value of the first address
	console.log(memory.get(addr[0])); //50

	// free up all the addresses for later use
	memory.free(addr);
})
```

### Memory Manager Example

You can pass the addresses provided by the memory manager directly into C/C++ as pointers.

The pointers are always referencing a `float` type.

**manager.c**
```c
#include <emscripten.h>

extern "C"
{
	EMSCRIPTEN_KEEPALIVE /* set the value at a given pointer */
	void setC(float* ptr, float value) {
		*ptr = value;
	}

	EMSCRIPTEN_KEEPALIVE /* get the value at a given pointer */
	float getC(float* ptr)
	{
		return *ptr;
	}

	EMSCRIPTEN_KEEPALIVE /* add two pointers */
	float addC(float* ptr1, float* ptr2) 
	{
		float p1 = *ptr1;
		float p2 = *ptr2;
		return p1 + p2;
	}
}
```

**manager.js**
```js
const wasm = require("./manager.c");
wasm.init().then((module) => {
	const memory = module.memoryManager;

	// get two slots/variables in memory
	const addr = memory.malloc(2);
	memory.set(addr[0], 50); // set slot 0 to 50;
	memory.set(addr[1], 25); // set slot 1 to 25;

	// read values from C or Javascript
	console.log(memory.get(addr[0])) // get slot 0 in js, returns 50;
	console.log(module.exports.getC(addr[0])) // get slot 0 in C, also returns 50;

	// adjust values with Javascript
	memory.set(addr[0], 30); // set slot 0 to 30 with JS;
	console.log(memory.get(addr[0])) // slot 0 in js, returns 30 this time;
	console.log(module.exports.getC(addr[0])) // slot 0 in C will also return 30;

	// adjust values with C
	module.exports.setC(addr[0], 10); // set slot 0 to 10 now with C;
	console.log(memory.get(addr[0])) // slot 0 in js, returns 10 now;
	console.log(module.exports.getC(addr[0])) // slot 0 in C will also return 10;

	console.log(module.exports.addC(addr[0], addr[1])) // use C to add the two numbers, returns 35;
	console.log(memory.get(addr[0]) + memory.get(addr[1])) // use JS to add the two numbers, also 35;
	
	// free up the memory
	memory.free(addr);
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
