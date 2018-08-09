'use strict';

const _options = require('./options');


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

function buildModule(externalWASM, wasmFileName, disableMemoryClass, publicPath, wasmArray, memoryJS) {


	return `module.exports = {
		init: (adjustEnv) => {

			${disableMemoryClass ? "" : memoryJS}

			adjustEnv = adjustEnv || function(obj) { return obj};

			if (typeof WebAssembly === "undefined") {
				rej("No Webassembly support!");
				return;
			}
			const WASM_PAGE_SIZE = 65536;
			const TOTAL_MEMORY = 16777216;
			const mem = new WebAssembly.Memory({
				'initial': TOTAL_MEMORY / WASM_PAGE_SIZE,
				'maximum': TOTAL_MEMORY / WASM_PAGE_SIZE
			});
			const table = new WebAssembly.Table({
				'initial': 10,
				'maximum': 10,
				'element': 'anyfunc'
			});
			const noop = (v) => v;

			const staticAlloc = (size) => {
				let ret = STATICTOP;
				STATICTOP = (STATICTOP + size + 15) & -16;
				return ret;
			}

			let STATICTOP = 2752;
			let tempDoublePtr = STATICTOP; STATICTOP += 16;
			let DYNAMICTOP_PTR = staticAlloc(4);

			${disableMemoryClass ? "" : "const asmMEM = new ASM_Memory(mem.buffer);"}

			${externalWASM ? `if (typeof fetch === "undefined") {
				rej("No fetch support!");
				return;
			}` : `const wasmBinary = new Uint8Array(${JSON.stringify(wasmArray)})`}


			const webAssemblyConfig = {
				env: adjustEnv({
					'_time': (ptr) => {
						return Date.now();
					},
					'___setErrNo': noop,
					'_console': (n) => console.log(n),
					${disableMemoryClass ? "" :
					`'_mallocjs': (len, type) => asmMEM.malloc(len, type || 40)[0],
					'_freejs': (start, len, type) => {
						type = type || 40;
						let bytes = type > 4 ? Math.round(type / 10) : type;
						let arr = [];
						for (let i = 0; i < len; i++) {
							arr.push(start + (i * bytes));
						}
						asmMEM.free(arr, type);
					},`}
					'enlargeMemory': noop,
					'getTotalMemory': () => TOTAL_MEMORY,
					'abortOnCannotGrowMemory': noop,
					'abortStackOverflow': noop,
					'DYNAMICTOP_PTR': DYNAMICTOP_PTR,
					'tempDoublePtr': tempDoublePtr,
					'abort': (err) => {
						throw new Error(err)
					},
					'abortStackOverflow': _ => {
						throw new Error('overflow');
					},
					'memory': mem,
					'memoryBase': 1024,
					'table': table,
					'tableBase': 0,
					'STACKTOP': 0,
					'STACK_MAX': mem.buffer.byteLength,
				})
			};

			return new Promise((res, rej) => {

				const init = WebAssembly.instantiateStreaming || WebAssembly.instantiate;
				const hasStreaming = typeof WebAssembly.instantiateStreaming === "function";

				(() => {
					if (hasStreaming) {
						return init(${externalWASM ? `fetch("${wasmFileName}")` : `new Response(wasmBinary, {
							headers: {
								"content-type": "application/wasm"
							}
						})`}, webAssemblyConfig)
					} else {
						${externalWASM ? `return fetch("${wasmFileName}").then(r => r.arrayBuffer()).then((bin) => {
								return init(bin, webAssemblyConfig);
							});` : `return init(wasmBinary, webAssemblyConfig);`}
					}
				})().then(e => {
					res({
						exports: Object.keys(e.instance.exports).reduce((prev, cur) => {
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

		const defaultFlags = [inputFile, '-s', 'WASM=1', "-s", "BINARYEN=1", this.minimize ? "-Os" : "-O1"];

		if (options.emccFlags && typeof options.emccFlags === "function") {
			options.emccFlags = options.emccFlags && typeof options.emccFlags === "function" ? options.emccFlags(defaultFlags) : defaultFlags;
		} else if (options.emccFlags && Array.isArray(options.emccFlags)) {	
			options.emccFlags = defaultFlags.concat(options.emccFlags);
		} else {
			options.emccFlags = defaultFlags;
		}
		
		folder = await tmpDir();

		// write source to tmp directory
		await writeFile(path.join(folder, inputFile), content);

		// compile source file to WASM
		await execFile(options.emccPath, options.emccFlags.concat(['-o', indexFile]), {
			cwd: folder
		});

		const wasmFile = wasmBuildName;
		const wasmContent = await readFile(path.join(folder, wasmFile));

		const memoryModule = await readFile(path.join(__dirname, "mem.js"));

		const wasmFileName = this.resourcePath.split(/\\|\//gmi).pop().split(".").shift() + ".wasm";

		const module = buildModule(options.externalWasm, wasmFileName, options.disableMemoryClass, options.publicPath, wasmContent.toString("hex").match(/.{1,2}/g).map(s => parseInt(s, 16)), memoryModule);

		if (options.emitWasm || options.externalWasm) {
			this.emitFile(wasmFileName, wasmContent);
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