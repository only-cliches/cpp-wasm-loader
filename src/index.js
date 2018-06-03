'use strict';

const _options = require('./options');

function _toConsumableArray(arr) {
	if (Array.isArray(arr)) {
    let arr2 = Array(arr.length);
		for (let i = 0; i < arr.length; i++) {
			arr2[i] = arr[i];
		}
		return arr2;
	} else {
		return Array.from(arr);
	}
}

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

function buildModule(wasmArray) {

	return `module.exports = {
		init: () => {
			return new Promise((res, rej) => {
				const mem = new WebAssembly.Memory({initial: 256, maximum: 256});
				WebAssembly.instantiateStreaming(
					new Response(new Uint8Array(${JSON.stringify(wasmArray)}), {headers: {"content-type":"application/wasm"}}), 
					{
						env: {
							'abortStackOverflow': _ => { throw new Error('overflow'); },
							'table': new WebAssembly.Table({initial: 0, maximum: 0, element: 'anyfunc'}),
							'tableBase': 0,
							'memory': mem,
							'memoryBase': 1024,
							'STACKTOP': 0,
							'STACK_MAX': mem.buffer.byteLength,
						}
					}
				)
				.then(e => {
					res(e.instance.exports);
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

		options.emccFlags = [inputFile, '-s', 'WASM=1'].concat(_toConsumableArray(options.emccFlags), ['-o', indexFile]);

		folder = await tmpDir();

		// write source to tmp directory
		await writeFile(path.join(folder, inputFile), content);

		// compile source file to WASM
		await execFile(options.emccPath, options.emccFlags, {
			cwd: folder
		});

		const wasmContent = await readFile(path.join(folder, wasmFile));

		const module = buildModule(wasmContent.toString("hex").match(/.{1,2}/g).map(s => parseInt(s, 16)));

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