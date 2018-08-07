const wasm = require("./add.c");
wasm.init().then((mod) => {
    console.log(mod.exports.add(1, 2));
});