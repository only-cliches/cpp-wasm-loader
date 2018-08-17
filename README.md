# CPP to WASM Webpack Loader

<div align="center">
<a title="By Jeremy Kratz (https://github.com/isocpp/logos) [Copyrighted free use], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AISO_C%2B%2B_Logo.svg"><img height="128" alt="ISO C++ Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/ISO_C%2B%2B_Logo.svg/256px-ISO_C%2B%2B_Logo.svg.png"/></a>
<a title="By Carlos Baraza [CC0], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AWeb_Assembly_Logo.svg"><img height="128" alt="Web Assembly Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Web_Assembly_Logo.svg/512px-Web_Assembly_Logo.svg.png"/></a>

[![NPM](https://nodei.co/npm/cpp-wasm-loader.png?compact=true)](https://nodei.co/npm/cpp-wasm-loader/)
</div>


Load C/C++ source files directly into javascript with a zero bloat.

- Optional minimal emscripten execution environment, bundles with embedded wasm start at only **1.2kb gzipped**.
- WebAssembly can be embedded directly into your JS bundle or shipped separately and loaded asynchronously.
- Includes an optional memory manager class to easily handle `malloc` and `free` on the javascript side (saves ~6KB).
- Adding custom javascript functions to call from C/C++ or vise versa is a breaze.
- Supports optional `ASM.JS` compilation with auto fallback, works with IE10+.
- Possible to ship complete WASM bundle with ASMJS fallback in a single js file with **zero** xhr requests.
- The only C/C++ webpack loader that can inject the full emscripten environment into your bundles.

## Installation
1. Install Emscripten following the instructions [here](https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html).
2. Run `npm i cpp-wasm-loader --save-dev`.
3. Add this object to the `rules` section of your webpack build:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-wasm-loader'
	}
}
```
4. Make sure `.c` and `.cpp` are in the webpack resolve object:
```js
resolve: {
	extensions: ['.js', ".c", ".cpp"]
}
```

## Webpack Options
The webpack loader has several options, all of them optional:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-wasm-loader',
		options: {
			// emccFlags: (existingFlags: string[], mode?: "wasm"|"asmjs" ) => string[],
			// emccPath: String,
			// fetchFiles: Boolean, 
			// memoryClass: Boolean,
			// asmJs: Boolean, 
			// wasm: Boolean,
			// fullEnv: Boolean
		}
	}
}
```


| Option      | Type                                                       | Default                     | Description                                                                                                                                                                                                                                                                                                                                                                          |
|-------------|------------------------------------------------------------|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| emccFlags   | (existingFlags: string[], mode?: "wasm"\|"asmjs" ) => string[] | -s WASM=1 -s BINARYEN=1 -Os | Modify compiler flags                                                                                                                                                                                                                                                                                                                                                                |
| emccPath    | String                                                     |                             | Only needed if emcc is not in PATH                                                                                                                                                                                                                                                                                                                                                   |
| memoryClass | Boolean                                                    | true                        | Pass `false` to omit the memory manager class in the bundle. Saves ~1kb.                                                                                                                                                                                                                                                                                                             |
| fetchFiles  | Boolean                                                    | false                       | Pass `true` to skip embedding the wasm/asmjs files into your js bundle.  You'll need to ship the .wasm and .asm.js files along with your .js files if you use this option.                                                                                                                                                                                                           |
| asmJs       | Boolean                                                    | false                       | Pass `true` to compile and embed an ASMJS version of your native code, the loader will fall back to ASMJS if Webassembly isn't supported. This will allow your native code to support IE10+.  If you add a TypedArray/ArrayBuffer polyfill (not included) you can get support back to IE9+.                                                                                          |
| wasm        | Boolean                                                    | true                        | Pass `false` to disable the Webassembly build/bundle entirely.  Useful with `asmJs` to make ASMJS only bundles.                                                                                                                                                                                                                                                                  |
| fullEnv     | Boolean                                                    | false                       | A majority of the default emscripten environment isn't included by default to keep the bundle size down.  To include the complete emscripten environment, pass `true`.  If you get missing exports errors, enable this.  The full enscripten environment takes 10-25KB+ (non gzipped), double that if you're supporting ASMJS & WASM in the same bundle. |

A fully working example webpack config file can be found [here](https://github.com/ClickSimply/cpp-wasm-loader/blob/master/example/webpack.config.js).

## Minimal Example
You can also view a complete working example on github [here](https://github.com/ClickSimply/cpp-wasm-loader/tree/master/example).

**add.c**
```c
#include <emscripten.h>

extern "C"
{
	/* Declare Javascript function for use in C/C++ */
	extern int sub(int a, int b);

	EMSCRIPTEN_KEEPALIVE /* <= Needed to export this function to javascript "module.exports" */
	int add(int a, int b)
	{
		return a + b;
	}

}
```

**add.js**
```js
const wasm = require("./add.c");
wasm.init((imports) => {
	// custom javascript function that can be called from C;
	imports._sub = (a, b) => a - b;
	return imports;
}).then((module) => {
	console.log(module.exports.add(1, 2)); // 3
	console.log(module.memory) // Raw ArrayBuffer Memory object
	console.log(module.memoryManager) // Memory Manager Class
	console.log(module.raw) // The complete unmodified return value of the webassembly init promise.
}).catch((err) => {
	console.error(err);
})
```

## ASM.JS Support
ASM.JS is specifically formatted javascript code that runs quite a bit faster than normal javascript.  Since it's just plain javascript it's supported by just about every browser with newer browsers supporting a special compilation with a performance boost.  When you pass `asmJs` into the webpack config object an `ASMJS` version of your native code will be bundled with the javascript.  If Webassembly support isn't detected the `ASMJS` code will be loaded instead, allowing your native code to work on anything back to Internet Explorer 10.

As of current (Q4 2018) `caniuse.com` stats, including ASMJS support moves your code from 75% global browser support to 95%.

IE9 isn't supported because it lacks Typed Arrays, if you bundle a [Typed Array PolyFill](https://cdn.rawgit.com/inexorabletash/polyfill/v0.1.41/typedarray.js) you can even get support in IE9. 

The only difference between loading ASMJS and Webassembly code is the `module` variable returned from the promise doesn't include some webassembly specific objects.  Speficially `module.raw` and `module.table` will be undefined when loading ASMJS instead of Webassembly.  ASMJS will also run considerably slower than Webassembly.

**Note:** ASMJS code will only be bundled when webpack is compiling in `production` mode.
**Note 2:** If you plan to support older browsers (any Internet Explorer version) make sure you bundle a Promise polyfill.  [lie-ts](https://npmjs.com/package/lie-ts) works and is only 1.2KB.

## Using The Memory Manager Class
The easiest way to move data between Javascript and Webassembly/C is by using the shared memory buffer.  The shared memory buffer allows javascript or C/C++ code to access the variables directly, mutate them and read them efficiently.  The problem is shared variables must be set to a specific address in the memory.  Sharing this address between Javascript and C/C++ as well as making sure you don't create a new variable over it can be a pain in the neck.  The memory manager class solves this problem.

The class can provide available memory addresses upon request.  Memory can be allocated and freed from either C/C++ or Javascript using the class.  The memory addresses can then be used to set or access the value of the variable at that address in Javascript or C/C++.  Using the memory manager class over native `malloc` and `free` in C can save ~6KB.

When using `malloc` or `struct` addresses are gauranteed to be contiguous just like in C/C++.

If you're unfamiliar with pointers/memory management jump to [this](#pointers-and-whatnot) part of the readme.

### Memory Manager API
To access the memory manager you can grab it off the module object after Webassembly has initialized:
```js
const wasm = require("./add.c");
wasm.init().then((module) => {
	const memory = module.memoryManager;

	// get a block of 20 available addresses.
	const addr = memory.malloc(20); 

	// set the first address to 50
	memory.set(addr[0], 50);

	// get the value of the first address
	console.log(memory.get(addr[0])); //50

	// free up all the addresses for later use
	memory.free(addr);

	// assign object to memory addresses
	const obj = memory.struct([
		"key", 100,
		"prop", 20,
		"nested", [
			"value", 10
		]
	]);

	
	console.log(memory.get(obj.key)) // 100
	console.log(memory.get(obj.prop)) // 20
	console.log(memory.get(obj.nested.value)) // 10

	// special properties
	console.log(obj._length) // 3, number of addresses (only first level)
	console.log(obj._totalLength) // 5, number of addresses (including all nested objects)
	console.log(obj._addr) // starting address
	console.log(obj._keys) // ["key", "prop", "nested"], array of keys (in address order)
	console.log(obj.nested._length) // 2, nested objects have an additional property "_up" in the first address slot which includes the parent slot address

	// free all memory used by object
	memory.free(obj);
})
```

### Memory Manager Detailed Example

You can pass the addresses provided by the memory manager directly into C/C++ as pointers.

The pointers are always referencing a 4 byte `float` type.

**manager.c**
```c
#include <emscripten.h>

extern "C"
{
	/* Functions provided by Memory API */
	extern double mallocjs(int len);
	extern void freejs(int start, int len);

	EMSCRIPTEN_KEEPALIVE /* Allocate memory, returns only the first memory address */
	double doMalloc(int len) {
		return mallocjs(len);
	}

	EMSCRIPTEN_KEEPALIVE /* Free memory */
	void doFree(int start, int len) {
		freejs(start, len);
	}

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

	EMSCRIPTEN_KEEPALIVE /* get address of pointer */
	float* address(float* ptr) 
	{
		return &*ptr;
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

	console.log(module.exports.address(addr[0]) === addr[0]) // true;
	
	// free up the memory
	memory.free(addr);
})
```

## Advanced Usage / Tips

### WebAssembly Memory
The `module.memory` export is a buffer that holds the raw memory object that is shared between javascript and webassembly.  You can read about how to use it in these [MDN docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory).

### Calling JS Functions from C/C++
It's pretty easy to setup JS functions to be called from within C/C++.  While it's technically possible to setup functions to use strings/charecters it's much easier to just stick to numbers.

Let's expose a function in javascript that will add two numbers

**customFn.js**
```js
const wasm = require("./customFn.c");
wasm.init((imports) => {
	// our custom javascript function
	imports._add = (a, b) => { 
		return a + b;
	}
	return imports;
}).then....
```

**customFn.c**
```c
#include <emscripten.h>

extern "C"
{
	/* Declare custom js function */
	extern int add(int a, int b);

	EMSCRIPTEN_KEEPALIVE /* calling the javascript function from a C function */
	int doAdd(int a, int b) {
		return add(a, b);
	}

}
```

WebAssembly can often crunch numbers several times faster than Javascript, but there is a **HEAVY** penalty to the execution speed when calling JS from C/C++ or vice versa.  The more you can send a batch job to C/C++ and pick it up later when it's done the better performance you'll experience.


## Pointers and Whatnot
WebAssembly shares a major limitation with many other low level languages: some memory must be managed by hand.

This isn't as difficult as it sounds, if you inilitize a variable inside a function in C/WebAssembly those are still cleaned up automatically.  We only need to concern ourselves with variables that are intended to stick around and be used across many functions.

To make this process easy, C/C++ provides an abstraction called pointers.  Pointers are just the memory address for a specific variable.  In most cases it's much better and more efficient to provide addresses/pointers to a function in C rather than the variables themselves.  We end up having to do much less work since values don't need to be copied around in memory.

But where do we get pointers?  We have to allocate a new memory slot for each variable we want with `malloc`, and when we perform that allocation we get a new pointer for each memory slot.  

The problem is there are only a limited number of slots, around 1 million with this library.  Once you use them all up, you're out of memory.

So to keep that from happening we want to use pointers whenever possible (so we're not creating copies of the same variable everywhere, but references to that variable), and when we're done with a variable we'll free up it's address with `free`. 

Let's see this in practice:
```js
const wasm = require("./manager.c");
wasm.init().then((module) => {
	const memory = module.memoryManager;

	// get one slot in memory
	const addr = memory.malloc(1);
	console.log("New Memory Addresses: " + addr); // [0]

	// adjust the value of that variable to equal 500;
	memory.set(addr[0], 500);

	// get the value of the variable at addr[0]
	console.log(memory.get(addr[0])) // 500;
	
	// free up this memory
	memory.free(addr);
});
```

So why not just do javascript variables?  The advantage of using the memory class is we're creating values/variables that can be accessed and modified from javascript *and* WebAssembly/C.  So we can use Javascript to inilitize the values and save the address/pointers to a javascript class, then pass the pointers into C functions when we need to perform expensive calculations.


## MIT License

Copyright 2018 Scott Lott & Jakub Beránek

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.