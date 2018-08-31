const wasm = require("./add.c");
wasm.init().then(function(mod) {
    console.log(mod.exports.add(2, 3));
});