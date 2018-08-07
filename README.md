# CPP to WASM Webpack Loader

<div>
<a title="By Carlos Baraza [CC0], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AWeb_Assembly_Logo.svg"><img height="128" alt="Web Assembly Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Web_Assembly_Logo.svg/512px-Web_Assembly_Logo.svg.png"/></a>
<a title="By Jeremy Kratz (https://github.com/isocpp/logos) [Copyrighted free use], via Wikimedia Commons" href="https://commons.wikimedia.org/wiki/File%3AISO_C%2B%2B_Logo.svg"><img height="128" alt="ISO C++ Logo" src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/ISO_C%2B%2B_Logo.svg/256px-ISO_C%2B%2B_Logo.svg.png"/></a>
</div>

[![NPM](https://nodei.co/npm/cpp-wasm-loader.png?downloads=true&stars=true)](https://nodei.co/npm/cpp-wasm-loader/)

Load C/C++ source files directly into javascript with a zero bloat.

- No external files, compiled webassembly is saved directly into the js bundle.
- Super small builds with minimal execution environment, bundles start at only **1.5kb gzipped**.
- Uses `WebAssembly.instantiateStreaming` to bypass Chrome 4k limit for WebAssembly modules.
- Provides export for WebAssembly memory management and access.
- Includes a small memory manager class to handle `malloc` and `free` on the javascript side (saves ~6KB).
- Easily add custom javascript functions to call from C/C++ or vise versa.

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
The webpack loader has several options:
```js
{
	test: /\.(c|cpp)$/,
	use: {
		loader: 'cpp-wasm-loader',
		options: {
			// emitWasm: true, // emit WASM file built by emscripten to the build folder
			// emccFlags: (existingFlags) => existingFlags.concat(["more", "flags", "here"]), // add or modify compiler flags
			// emccPath: "path/to/emcc", // only needed if emcc is not in PATH,
			// publicPath: Path from which your compiled wasm will be served. Should match `output.publicPath` in your webpack config. 
		}
	}
}
```

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
	// custom javascript function to be called from C;
	imports._sub = (a, b) => a - b;
	return imports;
}).then((module) => {
	console.log(module.exports.add(1, 2)); // 3
	console.log(module.memory) // Raw WebAssembly Memory object
	console.log(module.memoryManager) // Memory Manager Class
}).catch((err) => {
	console.error(err);
})
```

## Using The Memory Manager Class
The class can provide a list of available memory addresses upon request.  The memory addresses can be used to set or access the value of that variable in javascript or C/C++.  Using the memory manager class over `malloc` and `free` in C can save ~6KB.

If you're unfamiliar with pointers/memory management jump to [this](#pointers-and-whatnot) part of the readme.

Memory can be allocated through javascript or C/C++.  Values can be read or adjusted by C/C++ or Javascript using the provided memory addresses.

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
The `module.memory` export is a buffer that holds memory that is shared between javascript and webassembly.  You can read about how to use it in these [MDN docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory).

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