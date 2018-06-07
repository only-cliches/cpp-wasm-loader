const path = require('path');
const webpack = require("webpack");

module.exports = {
    entry: {
        "add": [path.join(__dirname, 'add.js')]
    },
    output: {
        path: path.join(__dirname, 'build'),
        filename: '[name].min.js',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    resolve: {
        extensions: ['.js', ".c"]
    },
    module: {
        rules: [
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
        ]
    }
};