'use strict';

const _options = require('./options');

const _bluebird = require('bluebird');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const rimraf = require('rimraf');
const md5 = require("md5");

const tmpDir = _bluebird.promisify(tmp.dir);
const readFile = _bluebird.promisify(fs.readFile);
const writeFile = _bluebird.promisify(fs.writeFile);
const unlink = (fileName) => {
	return new Promise((res, rej) => {
		fs.unlink(fileName, (err) => {
			res();
		});
	});
}
const execFile = _bluebird.promisify(cp.execFile);
const rf = _bluebird.promisify(rimraf);

function minimalEnv(memoryClass) {
	return `
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

		${!memoryClass ? `
			Module.asmClass = {scan: function() {}};
		` : `				
			Module.asmClass = new ASM_Memory(Module.buffer);
		`}

		var globalEnv = {
			"global": (typeof window !== "undefined" ? window : self),
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
	`;
}

function asmJSloader(fetchFiles, asmJSCode, asmjsEnv, wasmFileName, memoryJS, asmjsMem) {

	let initASMJS = "";

	if (asmjsEnv && asmjsEnv.length) {
		// full environment
		initASMJS = `${asmjsEnv.replace("// EMSCRIPTEN_START_ASM",`
				// EMSCRIPTEN_START_ASM\n
				${!memoryJS ? `
					Module.asmClass = {scan: function() {}};
				` : `				
					Module.asmClass = new ASM_Memory(Module.buffer);
				`} Module.asmLibraryArg = bindMemory(Module.asmLibraryArg, Module.asmClass, "asmjs");`
			)}

			setTimeout(function() {
				Module.asmClass.scan();
				resolve({
					exports: Object.keys(asm).reduce(function(prev, cur) {
						prev[cur.replace("_", "")] = asm[cur];
						return prev;
					}, {}),
					memory: Module.buffer,
					emModule: Module,
					${!memoryJS ? "" : "memoryManager: Module.asmClass,"}
				});
			}, 10);
		`;
	} else {
		// minimal environment
		initASMJS = `
			${asmjsMem && asmjsMem.length ? `var heap8 = new Uint8Array(Module.buffer);
			heap8.set(new Uint8Array([${asmjsMem}]), 8);` : ""}

			${!memoryJS ? `
				Module.asmClass = {scan: function() {}};
			` : `				
				Module.asmClass = new ASM_Memory(Module.buffer);
				Module.asmClass.scan();
			`}
			globalEnv.env = bindMemory(globalEnv.env, Module.asmClass, "asmjs");

			// init asmjs
			var exports = Module["asm"](window, globalEnv.env, Module.buffer);
			
			resolve({
				exports: Object.keys(exports).reduce(function(prev, cur) {
					prev[cur.replace("_", "")] = exports[cur];
					return prev;
				}, {}),
				memory: Module.buffer,
				emModule: Module,
				${!memoryJS ? "" : "memoryManager: Module.asmClass,"}
			});
		`;
	}

	let code = `
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
	`;
	
	if (fetchFiles) {
		code += `
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

			var path = typeof location !== "undefined" ? location.pathname.split("/") : [];
			path.pop();
			Module.buffer = ie && ie < 10 ? new ArrayBuffer(100000) : Module.buffer;

			loadJS(path.join("/") + "/" + "${wasmFileName.replace(".wasm", ".asm.js")}", function() {
				${initASMJS}
			});
		`;
	} else {
		code += `
			${asmJSCode}
			${initASMJS}
		`;
	}
	return code;
}

function wasmLoader(fetchFiles, wasmArray, wasmEnv, wasmFileName, memoryJS) {
	

	return `
		var instanceCallback;

		${wasmEnv ? wasmEnv.replace("[custom-loader]", `
			Module["wasmBinary"] = [];
			globalEnv = info;
			function instantiateArrayBuffer(receiver) {
				instanceCallback = receiver;
				${!memoryJS ? `
					Module.asmClass = {scan: function() {}};
				` : `				
					Module.asmClass = new ASM_Memory(Module.buffer);
				`}
			}
		`) : `
			if (!globalEnv.env["table"]) {
				var TABLE_SIZE = Module["wasmTableSize"] || 6;
				var MAX_TABLE_SIZE = Module["wasmMaxTableSize"] || 6;
				if (typeof WebAssembly === "object" && typeof WebAssembly.Table === "function") {
					if (MAX_TABLE_SIZE !== undefined) {
						globalEnv.env["table"] = new WebAssembly.Table({
							"initial": TABLE_SIZE,
							"maximum": MAX_TABLE_SIZE,
							"element": "anyfunc"
						})
					} else {
						globalEnv.env["table"] = new WebAssembly.Table({
							"initial": TABLE_SIZE,
							element: "anyfunc"
						})
					}
				} else {
					globalEnv.env["table"] = new Array(TABLE_SIZE)
				}
				Module["wasmTable"] = globalEnv.env["table"]
			}
			if (!globalEnv.env["memoryBase"]) {
				globalEnv.env["memoryBase"] = Module["STATIC_BASE"]
			}
			if (!globalEnv.env["tableBase"]) {
				globalEnv.env["tableBase"] = 0
			}
			if (!globalEnv.env["memory"]) {
				globalEnv.env["memory"] = Module["wasmMemory"];
			}
		`}

		${fetchFiles ? `` : `var wasmBinary = new Uint8Array(${JSON.stringify(wasmArray)})`}

		var init = WebAssembly.instantiateStreaming || WebAssembly.instantiate;
		var hasStreaming = typeof WebAssembly.instantiateStreaming === "function";
	
		globalEnv.env = bindMemory(globalEnv.env, Module.asmClass, "wasm");
	
		var path = typeof location !== "undefined" ? location.pathname.split("/") : [];
		path.pop();
	
		(function() {
			if (hasStreaming) {
				return init(${fetchFiles ? `fetch(path.join("/") + "/" + "${wasmFileName}")` : `new Response(wasmBinary, {
					headers: {
						"content-type": "application/wasm"
					}
				})`}, globalEnv)
			} else {
				${fetchFiles ? `return fetch(path.join("/") + "/" + "${wasmFileName}").then(r => r.arrayBuffer()).then((bin) => {
						return init(bin, globalEnv);
					});` : `return init(wasmBinary, globalEnv);`}
			}
		})().then(function(e) {	
			if (instanceCallback) {
				instanceCallback(e);
			}
			resolve({
				raw: e,
				emModule: Module,
				exports: Object.keys(e.instance.exports).reduce(function(prev, cur) {
					prev[cur.replace("_", "")] = e.instance.exports[cur];
					return prev;
				}, {}),
				memory: Module.buffer,
				${!memoryJS ? "" : "memoryManager: Module.asmClass,"}
			});
		}).catch(reject);

	`;
}

function buildModule(wasmEnv, asmjsEnv, asmJSCode, asmjsMem, fetchFiles, wasmFileName, memoryJS, wasmArray) {
	return `module.exports = {
		init: function(adjustEnv) {
			if (typeof Promise === "undefined") {
				throw new Error("No Promise support!");
			}
			if (typeof ArrayBuffer === "undefined") {
				throw new Error("No ArrayBuffer support!");
			}

			${fetchFiles ? `
			if (typeof fetch === "undefined") {
				throw new Error("No Fetch support!");
			}
			` : ``}

			adjustEnv = typeof adjustEnv === "undefined" ? function(obj) { return obj} : adjustEnv;

			${memoryJS ? `
				${memoryJS}		
				function bindMemory(env, memClass, type) {
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
					return adjustEnv(env, type);
				}
			` : `
				function bindMemory(env, memClass, type) { return adjustEnv(env, type) };
			`}
			
			${fetchFiles ? `window.Module = {}` : `var Module = {}`};
			var globalEnv = {};
			
			return new Promise((resolve, reject) => {
				// embed minimal invironemnt as long as neither ASMJS or WASM environments exist
				${wasmEnv || asmjsEnv ? `` : minimalEnv(memoryJS)}

				// ASMJS support
				${asmJSCode ? `if (${wasmArray.length === 0 ? `true` : `typeof WebAssembly === "undefined"`}) {
					${asmJSloader(fetchFiles, asmJSCode, asmjsEnv, wasmFileName, memoryJS, asmjsMem)}
					return;
				}` : ``}

				// WASM support
				${wasmArray.length ? `
					if (typeof WebAssembly === "undefined") {
						throw new Error("No Webassembly support!");
					}
					${wasmLoader(fetchFiles, wasmArray, wasmEnv, wasmFileName, memoryJS)}
				` : ``}
			});
		}
	}`;
}

function createBuildWasmName(resource, content) {
	const fileName = path.basename(resource, path.extname(resource));
	return `${fileName}-${md5(content)}.wasm`;
}

exports.default = async function loader(content) {
	let cb = this.async();
	// let folder = null;

	try {
		const options = (0, _options.loadOptions)(this);

		if (!options.asmJs && !options.wasm) {
			throw new Error("Oops!  You need to enable ASMJS or WASM support in cpp-wasm-loader options!")
		}

		const inputFile = `input${path.extname(this.resourcePath)}`;
		const wasmBuildName = createBuildWasmName(this.resourcePath, content);
		const indexFile = wasmBuildName.replace('.wasm', '.js');
		
		// folder = await tmpDir();
		
		// write source to tmp directory
		// await writeFile(path.join(folder, inputFile), content);

		const buildWASM = this.minimize ? options.wasm : true;
		const buildASMJS = this.minimize ? options.asmJs : false;
		let asmJSCode = "";
		let asmjsEnv = "";
		let asmjsMem = [];

		if (buildASMJS) {
			let ASMJSFlags = [this.resourcePath, '-s', 'WASM=0',"--separate-asm", "-Os"];
			if (!options.fullEnv) {
				ASMJSFlags = ASMJSFlags.concat(["-s", "ONLY_MY_CODE=1"])
			}
			if (options.emccFlags && typeof options.emccFlags === "function") {
				ASMJSFlags = options.emccFlags(ASMJSFlags, "asmjs");
			} else if (options.emccFlags && Array.isArray(options.emccFlags)) {	
				ASMJSFlags = ASMJSFlags.concat(options.emccFlags);
			}
			// compile source file to ASMJS
			await execFile(options.emccPath, ASMJSFlags.concat(['-o', indexFile]), {
				cwd: this.context
			});
			asmJSCode = await readFile(path.join(this.context, indexFile.replace(".js", ".asm.js")));
			asmJSCode = asmJSCode.toString();

			asmjsEnv = options.fullEnv ? await readFile(path.join(this.context, indexFile)) : "";
			
			asmjsEnv = asmjsEnv.toString().replace(/var Module.+?;/gm, "");

			// remove node require statements
			if (this.target !== "node") {
				asmjsEnv = asmjsEnv				
					.replace(/require\(.fs.\)/gmi, "undefined") 
					.replace(/require\(.path.\)/gmi, "undefined")
			}

			// embed ASMJS memory file
			try {
				asmjsMem = await readFile(path.join(this.context, indexFile + ".mem"));
				asmjsMem = asmjsMem.toString("hex").match(/.{1,2}/g).map(s => parseInt(s, 16));
			} catch(e) {
	
			}

			if (asmjsMem.length && asmjsEnv) {
				let initArrayBuff = asmjsEnv.indexOf("if (memoryInitializer)");
				if (initArrayBuff === -1) {
					initArrayBuff = asmjsEnv.indexOf("if(memoryInitializer)");
				}
				let initArrayBuffEnd = initArrayBuff;
				let level = 0;
				let ptr = initArrayBuff;
				while (ptr !== -1 && ptr < asmjsEnv.length) {
					if (asmjsEnv[ptr] === "{") {
						level++;
						ptr++;
					} else if(asmjsEnv[ptr] === "}") {
						level--;
						if (level === 0) {
							initArrayBuffEnd = ptr + 1;
							ptr = -1;
						} else {
							ptr++;
						}
					} else {
						ptr++;
					}
				}
				asmjsEnv = asmjsEnv.substring(0, initArrayBuff) + `HEAPU8.set(new Uint8Array([${asmjsMem}]), GLOBAL_BASE);` + asmjsEnv.substring(initArrayBuffEnd, asmjsEnv.length + 1);
			}
		}

		let wasmHex = [];
		let wasmEnv = "";
		let wasmContent = "";
		let wasmFileName = this.resourcePath.split(/\\|\//gmi).pop().split(".").shift() + ".wasm";
		if (buildWASM) {
			let wasmFlags = [this.resourcePath, '-s', 'WASM=1', "-s", "BINARYEN=1", this.minimize ? "-Os" : "-O1"];

			if (options.emccFlags && typeof options.emccFlags === "function") {
				wasmFlags = options.emccFlags(wasmFlags, "wasm");
			} else if (options.emccFlags && Array.isArray(options.emccFlags)) {	
				wasmFlags = wasmFlags.concat(options.emccFlags);
			}
			// compile source file to WASM
			await execFile(options.emccPath, wasmFlags.concat(['-o', indexFile]), {
				cwd: this.context
			});

			const wasmFile = wasmBuildName;
			wasmContent = await readFile(path.join(this.context, wasmFile));
	
			wasmHex = wasmContent.toString("hex").match(/.{1,2}/g).map(s => parseInt(s, 16));
			wasmEnv = options.fullEnv ? await readFile(path.join(this.context, indexFile)) : "";

			if (wasmEnv && wasmEnv.length) {
				wasmEnv = wasmEnv.toString()
				// adjust code that causes minify error
				.replace(".replace(/\\\\/g,\"/\")", ".split('').map(function(s) { return s === '\\\\' ? '/' : s;}).join('');")
				.replace(/var Module.+?;/gm, "")

				// remove node require statements
				if (this.target !== "node") {
					wasmEnv = wasmEnv				
					.replace(/require\(.fs.\)/gmi, "undefined") 
					.replace(/require\(.path.\)/gmi, "undefined")
				}
	
				let initArrayBuff = wasmEnv.indexOf("function instantiateArrayBuffer");
				let initArrayBuffEnd = initArrayBuff;
				let level = 0;
				let ptr = initArrayBuff;
				while (ptr !== -1 && ptr < wasmEnv.length) {
					if (wasmEnv[ptr] === "{") {
						level++;
						ptr++;
					} else if(wasmEnv[ptr] === "}") {
						level--;
						if (level === 0) {
							initArrayBuffEnd = ptr + 1;
							ptr = -1;
						} else {
							ptr++;
						}
					} else {
						ptr++;
					}
				}
	
				wasmEnv = wasmEnv.substring(0, initArrayBuff) + "[custom-loader]" + wasmEnv.substring(initArrayBuffEnd, wasmEnv.length + 1);
			}
		}

		let memoryModule = options.memoryClass ? await readFile(path.join(__dirname, "mem.js")) : "";
		memoryModule = memoryModule.toString();

		const module = buildModule(wasmEnv, asmjsEnv, asmJSCode, asmjsMem, options.fetchFiles, wasmFileName, memoryModule, wasmHex);

		if (buildWASM && options.fetchFiles) {
			this.emitFile(wasmFileName, wasmContent);
		}

		if (buildASMJS && options.fetchFiles) {
			this.emitFile(this.resourcePath.split(/\\|\//gmi).pop().split(".").shift() + ".asm.js", asmJSCode);
		}

		/*if (folder !== null) {
			await rf(folder);
		}*/
		await unlink(path.join(this.context, indexFile));
		await unlink(path.join(this.context, indexFile.replace(".js", ".asm.js")));
		await unlink(path.join(this.context, indexFile.replace(".js", ".wasm")));
		await unlink(path.join(this.context, indexFile + ".mem"));
		cb(null, module);

	} catch (e) {
		/*if (folder !== null) {
			await rf(folder);
		}*/
		cb(e);
	}

	return null;
};

// em++ -Os -s WASM=0 -s ONLY_MY_CODE=1  add.c -o output.js
