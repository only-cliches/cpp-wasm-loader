# CPP to WASM Webpack loader
Ever wanted to include C/C++ files directly from Javascript?
Well now you can.

This Webpack loader allows you to import C or C++ files, which are
compiled to WASM using Emscripten.

The C/C++ files have to know about Emscripten, so you can export functions. For simple
things it's enough to include emscripten and add EMSCRIPTEN_KEEPALIVE to your functions
(+ extern "C" for C++).

You should be able to run simple C/C++ files in any modern browser that supports WASM
(Chrome, Firefox etc.).

## Usage
Webpack settings
```js
module.exports = {
  // ...
  module: {
    rules: [
      {
        test: /\.(c|cpp)$/,
        use: {
          loader: 'cpp-wasm-loader',
          options: {
            // Path to your 'build' or 'dist' directory relative to project root
            buildPath: 'build',
            emccPath: 'path-to-emcc',
            emccFlags: ['-O3']
          }
        }
      },
      // ...
    ]
  }
}
```

C/C++ file
```c
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <emscripten/emscripten.h>

int main(int argc, char ** argv)
{
    printf("WASM loaded\n");
}

// Simple C function that returns a number between 1 and 6.
int EMSCRIPTEN_KEEPALIVE roll_dice() {
    srand ( time(NULL) );
    return rand() % 6 + 1;
}
```

Usage in Javascript
```js
import wasm from './source.c';

wasm.initialize().then(module => {
  const result = module._roll_dice();
  console.log(result);
});
```

### Configuration
The following options can be added to the Webpack loader query:

| Name | Description | Required | Default |
| ---- | ----------- | -------- | ------- |
| `buildPath` |  Path to your 'build' or 'dist' directory relative to project root | true| |
| `emccPath` | Path to your Emscripten binary (emcc or em++) | false | emcc |
| `emccFlags` | Array of compilation flags passed to Esmcripten | false | ['-O3'] |

### Requirements
Emscripten

#### License
MIT

#### Ideas
* generate Typescript definitions (using Clang)
* automatically export functions (using Clang)

#### Inspiration
Inspired by [rust-wasm-loader](https://www.npmjs.com/package/rust-wasm-loader) and
[this article](https://tutorialzine.com/2017/06/getting-started-with-web-assembly).
WASM alternative of [cpp-loader](https://www.npmjs.com/package/cpp-loader).
