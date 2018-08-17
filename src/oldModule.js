
	const initASMJS = `// adjust envrionment
		
    ${fullEnv ? `${asmjsEnv
        .replace("var asm = Module[\"asm\"]",`${disableMemoryClass ? `
            Module.asmClass = {};
        ` : `				
            Module.asmClass = new ASM_Memory(Module.buffer);
        `} Module.asmLibraryArg = adjustEnv(bindMemory(Module.asmLibraryArg, Module.asmClass)); var asm = Module[\"asm\"]`)
        .replace("var asmMem = '[asm-mem]';", `
            Module["HEAPU8"].set(new Uint8Array([${asmjsMem}]), GLOBAL_BASE);
        `)}

        res({
            exports: Object.keys(asm).reduce(function(prev, cur) {
                prev[cur.replace("_", "")] = asm[cur];
                return prev;
            }, {}),
            memory: Module.buffer,
            ${disableMemoryClass ? "" : "memoryManager: Module.asmClass,"}
        })
    ` : `
        ${disableMemoryClass ? `
            Module.asmClass = {};
        ` : `				
            Module.asmClass = new ASM_Memory(Module.buffer);
        `}
        info.env = adjustEnv(bindMemory(info.env, Module.asmClass));

        ${asmjsMem && asmjsMem.length ? `var heap8 = new Uint8Array(Module.buffer);
        heap8.set(new Uint8Array([${asmjsMem}]), 8);` : ""}
        // init asmjs
        var exports = Module["asm"](window, info.env, Module.buffer);
        
        res({
            exports: Object.keys(exports).reduce(function(prev, cur) {
                prev[cur.replace("_", "")] = exports[cur];
                return prev;
            }, {}),
            memory: Module.buffer,
            ${disableMemoryClass ? "" : "memoryManager: Module.asmClass,"}
        });
    
    `}

    `;

const loadModule = `if (${noWASM ? `true` : `typeof WebAssembly === "undefined"`}) {

    var ie = (function(){

        var undef,
            v = 3,
            div = document.createElement('div'),
            all = div.getElementsByTagName('i');
        
        while (
            div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
            all[0]
        );
        
        return v > 4 ? v : undef;
        
    }());

    if (typeof ArrayBuffer === "undefined") {
        throw new Error("No ArrayBuffer support!");
    }
    
    // ASMJS support
    ${asmJScontent && asmJScontent.length ? (fetchFiles ? `
        function loadJS(src, callback) {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onreadystatechange = s.onload = function() {
                var state = s.readyState;
                if (!callback.done && (!state || /loaded|complete/.test(state))) {
                    callback.done = true;
                    callback();
                }
            };
            document.getElementsByTagName('head')[0].appendChild(s);
        }

        var path = location.pathname.split("/");
        path.pop();
        Module.buffer = ie && ie < 10 ? new ArrayBuffer(100000) : Module.buffer;

        loadJS(path.join("/") + "/" + "${wasmFileName.replace(".wasm", ".asm.js")}", function() {
            ${initASMJS}
        });

    ` : `
        Module.buffer = ie && ie < 10 ? new ArrayBuffer(100000) : Module.buffer;
        ${asmJScontent}
        ${initASMJS}

    `) : `throw new Error("No Webassembly support!")`};
    return;
}

${noWASM ? `` : `
    
    ${fetchFiles ? `` : `var wasmBinary = new Uint8Array(${JSON.stringify(wasmArray)})`}


    var init = WebAssembly.instantiateStreaming || WebAssembly.instantiate;
    var hasStreaming = typeof WebAssembly.instantiateStreaming === "function";

    if (!info.env["table"]) {
        var TABLE_SIZE = Module["wasmTableSize"] || 6;
        var MAX_TABLE_SIZE = Module["wasmMaxTableSize"] || 6;
        if (typeof WebAssembly === "object" && typeof WebAssembly.Table === "function") {
            if (MAX_TABLE_SIZE !== undefined) {
                info.env["table"] = new WebAssembly.Table({
                    "initial": TABLE_SIZE,
                    "maximum": MAX_TABLE_SIZE,
                    "element": "anyfunc"
                })
            } else {
                info.env["table"] = new WebAssembly.Table({
                    "initial": TABLE_SIZE,
                    element: "anyfunc"
                })
            }
        } else {
            info.env["table"] = new Array(TABLE_SIZE)
        }
        Module["wasmTable"] = info.env["table"]
    }
    if (!info.env["memoryBase"]) {
        info.env["memoryBase"] = Module["STATIC_BASE"]
    }
    if (!info.env["tableBase"]) {
        info.env["tableBase"] = 0
    }
    if (!info.env["memory"]) {
        info.env["memory"] = Module["wasmMemory"];
    }

    info.env = adjustEnv(bindMemory(info.env, Module.asmClass));

    var path = location.pathname.split("/");
    path.pop();

    (function() {
        if (hasStreaming) {
            return init(${fetchFiles ? `fetch(path.join("/") + "/" + "${wasmFileName}")` : `new Response(wasmBinary, {
                headers: {
                    "content-type": "application/wasm"
                }
            })`}, info)
        } else {
            ${fetchFiles ? `return fetch(path.join("/") + "/" + "${wasmFileName}").then(r => r.arrayBuffer()).then((bin) => {
                    return init(bin, info);
                });` : `return init(wasmBinary, info);`}
        }
    })().then(function(e) {	
        if (instanceCallback) {
            instanceCallback(e);
        }
        res({
            raw: e,
            emModule: Module,
            exports: Object.keys(e.instance.exports).reduce(function(prev, cur) {
                prev[cur.replace("_", "")] = e.instance.exports[cur];
                return prev;
            }, {}),
            memory: Module.buffer,
            ${disableMemoryClass ? "" : "memoryManager: Module.asmClass,"}
        });
    }).catch(rej);
    
`}`;

return `module.exports = {
    init: function(adjustEnv) {

        if (typeof Promise === "undefined") {
            throw new Error("Promise must be polyfilled!");
        }

        return new Promise(function(res, rej) {

            ${disableMemoryClass ? `
                function bindMemory(env, memClass) { return env };
            ` : `
                ${memoryJS}
                
                function bindMemory(env, memClass) {
                    env._mallocjs = function(len, type) {
                        return memClass.malloc(len, type || 40)[0]
                    };
                    env._freejs = function(start, len, type) {
                        type = type || 40;
                        var bytes = type > 4 ? Math.round(type / 10) : type;
                        var arr = [];
                        for (var i = 0; i < len; i++) {
                            arr.push(start + (i * bytes));
                        }
                        memClass.free(arr, type);
                    };
                    return env;
                }
            `}

            

            adjustEnv = adjustEnv || function(obj) { return obj};

            var Module = Module || {};
            var instanceCallback;

            ${fullEnv && fullEnv.length ? (noWASM ? `` : `
             (function() {${fullEnv.replace("[custom-loader]", `
                Module["wasmBinary"] = [];
                function instantiateArrayBuffer(receiver) {
                    instanceCallback = receiver;
                    ${disableMemoryClass ? `
                        Module.asmClass = {};
                    ` : `				
                        Module.asmClass = new ASM_Memory(Module.buffer);
                    `}
                    ${loadModule}
                }
            `)}})()
            `) : `
            var WASM_PAGE_SIZE = 65536;
            var TOTAL_MEMORY = 16777216;
            var noop = function(v) { return v};
            var staticAlloc = function(size) {
                var ret = STATICTOP;
                STATICTOP = (STATICTOP + size + 15) & -16;
                return ret;
            }

            var STATICTOP = 2752;
            var tempDoublePtr = STATICTOP; STATICTOP += 16;
            var DYNAMICTOP_PTR = staticAlloc(4);

            var buffer;
            if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
                Module["wasmMemory"] = new WebAssembly.Memory({
                    "initial": TOTAL_MEMORY / WASM_PAGE_SIZE,
                    "maximum": TOTAL_MEMORY / WASM_PAGE_SIZE
                });
                buffer = Module["wasmMemory"].buffer
            } else {
                buffer = new ArrayBuffer(TOTAL_MEMORY);
            }
            Module.buffer = buffer

            ${disableMemoryClass ? `
                Module.asmClass = {};
            ` : `				
                Module.asmClass = new ASM_Memory(Module.buffer);
            `}

            var info = {
                "global": window,
                "env": {
                    '_time': function(ptr) {
                        return Date.now();
                    },
                    '___setErrNo': noop,
                    '_console': function(n) { console.log(n) },
                    '_emscripten_memcpy_big': function(dest, src, num) {
                        var heap8 = new Uint8Array(mem);
                        heap8.set(heap8.subarray(src, src + num), dest);
                        return dest
                    },
                    'enlargeMemory': noop,
                    'getTotalMemory': function() { return TOTAL_MEMORY },
                    'abortOnCannotGrowMemory': noop,
                    'DYNAMICTOP_PTR': DYNAMICTOP_PTR,
                    'tempDoublePtr': tempDoublePtr,
                    'assert': function(condition, text) { 
                        if (!condition) { baseEnv.abort(text) } 
                    }, 
                    'ABORT': function(err) {
                        throw new Error(err);
                    },
                    'abort': function(err) {
                        throw new Error(err)
                    },
                    'abortStackOverflow': function() {
                        throw new Error('overflow');
                    },
                    'STACKTOP': 0,
                    'STACK_MAX': 16777216
                },
                "asm2wasm": {
                    "f64-rem": (function (x, y) {
                        return x % y
                    }),
                    "debugger": (function () {
                        debugger
                    })
                },
                "parent": Module
            };
            
            ${loadModule}
            
            `}
        });
    }
}`;