'use strict';

const _options = require('./options');

// em++ -Os -s WASM=0 -s ONLY_MY_CODE=1  add.c -o output.js

function _interopRequireDefault(obj) {
	return obj && obj.__esModule ? obj : {
		default: obj
	};
}

const _bluebird = require('bluebird');
const _bluebird2 = _interopRequireDefault(_bluebird);
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const rimraf = require('rimraf');
const md5 = require("md5");

const tmpDir = _bluebird2.default.promisify(tmp.dir);
const readFile = _bluebird2.default.promisify(fs.readFile);
const writeFile = _bluebird2.default.promisify(fs.writeFile);
const execFile = _bluebird2.default.promisify(cp.execFile);
const rf = _bluebird2.default.promisify(rimraf);

function buildModule(noWASM, asmJScontent, fetchFiles, wasmFileName, disableMemoryClass, publicPath, wasmArray, memoryJS) {

	let loadASMModule = `// adjust envrionment
		${disableMemoryClass ? "var asmMEM = {}" : "var asmMEM = new ASM_Memory(buffer);"}
		baseEnv = adjustEnv(baseEnv(asmMEM));

		// init asmjs
		var exports = Module["asm"](window, baseEnv, buffer);
		
		res({
			raw: {},
			exports: Object.keys(exports).reduce(function(prev, cur) {
				prev[cur.replace("_", "")] = exports[cur];
				return prev;
			}, {}),
			memory: buffer,
			${disableMemoryClass ? "" : "memoryManager: asmMEM,"}
			table: {},
			locateFile: function(name) { return ${JSON.stringify(publicPath)} + name; }
		});
		`;

	return `module.exports = {
		init: function(adjustEnv) {

			${disableMemoryClass ? "" : memoryJS}

			adjustEnv = adjustEnv || function(obj) { return obj};

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

			var baseEnv = function(mem) {
				return {
					'_time': function(ptr) {
						return Date.now();
					},
					'___setErrNo': noop,
					'_console': function(n) { console.log(n) },
					${disableMemoryClass ? `
					 '_mallocjs': noop,
					 '_freejs': noop,` :
					`'_mallocjs': function(len, type) {
						return mem.malloc(len, type || 40)[0]
					},
					'_freejs': function(start, len, type) {
						type = type || 40;
						var bytes = type > 4 ? Math.round(type / 10) : type;
						var arr = [];
						for (var i = 0; i < len; i++) {
							arr.push(start + (i * bytes));
						}
						mem.free(arr, type);
					},`}
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
				}
			}

			if (typeof Promise === "undefined") {
				throw new Error("Promise must be polyfilled!");
			}

			if (${noWASM ? `true` : `typeof WebAssembly === "undefined"`}) {

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

					if (!window.Module) {
						window.Module = {};
					}

					var path = location.pathname.split("/");
					path.pop();
					var buffer = new ArrayBuffer(ie && ie < 10 ? 100000 : 16777216);
					return new Promise(function(res, rej) {
						loadJS(path.join("/") + "/" + "${wasmFileName.replace(".wasm", ".asm.js")}", function() {
							${loadASMModule}
						});
					});
				` : `
					var buffer = new ArrayBuffer(ie && ie < 10 ? 100000 : 16777216);
					
					var Module = {};
					${asmJScontent}
					return new Promise(function(res, rej) {
						${loadASMModule}
					});

				`) : `throw new Error("No Webassembly support!")`};
				return;
			}

			${noWASM ? `` : `
				
				${fetchFiles ? `` : `var wasmBinary = new Uint8Array(${JSON.stringify(wasmArray)})`}

				var mem = new WebAssembly.Memory({
					'initial': TOTAL_MEMORY / WASM_PAGE_SIZE,
					'maximum': TOTAL_MEMORY / WASM_PAGE_SIZE
				});

				var table = new WebAssembly.Table({
					'initial': 6,
					'maximum': 6,
					'element': 'anyfunc'
				});

				${disableMemoryClass ? "var asmMEM = {}" : "var asmMEM = new ASM_Memory(mem.buffer);"}

				// webassembly specific environment variables
				baseEnv = baseEnv(asmMEM);
				baseEnv.memory = mem;
				baseEnv.memoryBase = 1024;
				baseEnv.table = table;
				baseEnv.tableBase = 0;

				var webAssemblyConfig = {
					env: adjustEnv(baseEnv)
				};

				
				var init = WebAssembly.instantiateStreaming || WebAssembly.instantiate;
				var hasStreaming = typeof WebAssembly.instantiateStreaming === "function";

				var path = location.pathname.split("/");
				path.pop();

				return new Promise(function(res, rej) {
					(function() {
						if (hasStreaming) {
							return init(${fetchFiles ? `fetch(path.join("/") + "/" + "${wasmFileName}")` : `new Response(wasmBinary, {
								headers: {
									"content-type": "application/wasm"
								}
							})`}, webAssemblyConfig)
						} else {
							${fetchFiles ? `return fetch(path.join("/") + "/" + "${wasmFileName}").then(r => r.arrayBuffer()).then((bin) => {
									return init(bin, webAssemblyConfig);
								});` : `return init(wasmBinary, webAssemblyConfig);`}
						}
					})().then(function(e) {
						res({
							raw: e,
							exports: Object.keys(e.instance.exports).reduce(function(prev, cur) {
								prev[cur.replace("_", "")] = e.instance.exports[cur];
								return prev;
							}, {}),
							memory: mem,
							${disableMemoryClass ? "" : "memoryManager: asmMEM,"}
							table: table,
							locateFile: function(name) { return ${JSON.stringify(publicPath)} + name; }
						});
					}).catch(rej);
				});
			`}
		}
	}`;
}

function createBuildWasmName(resource, content) {
	const fileName = path.basename(resource, path.extname(resource));
	return `${fileName}-${md5(content)}.wasm`;
}

exports.default = async function loader(content) {
	let cb = this.async();
	let folder = null;

	try {
		const options = (0, _options.loadOptions)(this);


		const inputFile = `input${path.extname(this.resourcePath)}`;
		const wasmBuildName = createBuildWasmName(this.resourcePath, content);
		const indexFile = wasmBuildName.replace('.wasm', '.js');

		let wasmFlags = [inputFile, '-s', 'WASM=1', "-s", "BINARYEN=1", this.minimize ? "-Os" : "-O1"];

		if (options.emccFlags && typeof options.emccFlags === "function") {
			wasmFlags = options.emccFlags(wasmFlags, "wasm");
		} else if (options.emccFlags && Array.isArray(options.emccFlags)) {	
			wasmFlags = wasmFlags.concat(options.emccFlags);
		}
		
		folder = await tmpDir();

		let buildWASM = !options.noWasm && !options.emitWasm;

		// build WASM for development mode regardless
		if (!buildWASM && !this.minimize) {
			buildWASM = true;
		}

		// write source to tmp directory
		await writeFile(path.join(folder, inputFile), content);

		if (buildWASM) {
			// compile source file to WASM
			await execFile(options.emccPath, wasmFlags.concat(['-o', indexFile]), {
				cwd: folder
			});
		}



		let ASMContent = "";

		if (options.loadAsmjs && this.minimize) {
			let ASMJSFlags = [inputFile, '-s', 'WASM=0', '-s','ONLY_MY_CODE=1', "-Os"];
			if (options.emccFlags && typeof options.emccFlags === "function") {
				ASMJSFlags = options.emccFlags(defaultFlags, "asmjs");
			} else if (options.emccFlags && Array.isArray(options.emccFlags)) {	
				ASMJSFlags = ASMJSFlags.concat(options.emccFlags);
			}
			// compile source file to ASMJS
			await execFile(options.emccPath, ASMJSFlags.concat(['-o', indexFile]), {
				cwd: folder
			});
			ASMContent = await readFile(path.join(folder, indexFile.replace(".js", ".asm.js")));
			ASMContent = ASMContent.toString();
		}

		const wasmFile = wasmBuildName;
		const wasmContent = buildWASM ? await readFile(path.join(folder, wasmFile)) : "";

		const wasmHex = buildWASM ? wasmContent.toString("hex").match(/.{1,2}/g).map(s => parseInt(s, 16)) : [];

		const memoryModule = await readFile(path.join(__dirname, "mem.js"));

		const wasmFileName = this.resourcePath.split(/\\|\//gmi).pop().split(".").shift() + ".wasm";

		const module = buildModule(options.noWasm, ASMContent, options.fetchFiles, wasmFileName, options.disableMemoryClass, options.publicPath, wasmHex, memoryModule);

		if (buildWASM || options.fetchFiles) {
			if (options.emitWasm) {
				this.emitFile(wasmFileName, wasmContent);
			}
			if (ASMContent && ASMContent.length) {
				this.emitFile(this.resourcePath.split(/\\|\//gmi).pop().split(".").shift() + ".asm.js", ASMContent);
			}
		}
		if (folder !== null) {
			await rf(folder);
		}
		cb(null, module);

	} catch (e) {
		if (folder !== null) {
			await rf(folder);
		}
		cb(e);
	}

	return null;
};

// em++ -Os -s WASM=0 -s ONLY_MY_CODE=1  add.c -o output.js