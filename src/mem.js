"use strict";
var ASM_Memory = (function () {
    function ASM_Memory(buffer) {
        this.allocList = [];
        this.sizeList = [];
        this.allocPointer = 0;
        this.mem = {
            1: new Int8Array(buffer),
            2: new Int16Array(buffer),
            4: new Int32Array(buffer),
            40: new Float32Array(buffer),
            80: new Float64Array(buffer),
            i8: new Int8Array(buffer),
            i16: new Int16Array(buffer),
            i32: new Int32Array(buffer),
            f32: new Float32Array(buffer),
            f64: new Float64Array(buffer),
            char: new Int8Array(buffer),
            uchar: new Uint8Array(buffer),
            short: new Int16Array(buffer),
            ushort: new Uint16Array(buffer),
            int: new Int32Array(buffer),
            uint: new Uint32Array(buffer),
            float: new Float32Array(buffer),
            double: new Float64Array(buffer)
        };
        this.max = buffer.byteLength - 1;
    }
    ASM_Memory.prototype.mark = function (stackTop) {
        for (var i = 0; i <= stackTop; i++) {
            this.allocPointer = i;
            this.allocList[i] = true;
        }
    };
    ASM_Memory.prototype.scan = function () {
        var _this = this;
        this.mem.char.forEach(function (val, i) {
            if (val > 0) {
                _this.allocPointer = i;
                _this.allocList[i] = true;
            }
        });
    };
    ASM_Memory.prototype.set = function (addr, value, type) {
        if (type === void 0) { type = 40; }
        if (typeof addr !== "number" || typeof value !== "number") {
            throw new Error("Address & value must be a number!");
        }
        type = (this.sizeList[addr] || type);
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    };
    ASM_Memory.prototype.get = function (addr, type) {
        if (type === void 0) { type = 40; }
        if (typeof addr !== "number") {
            throw new Error("Address must be a number!");
        }
        type = (this.sizeList[addr] || type);
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    };
    ASM_Memory.prototype.avail = function (type) {
        if (type === void 0) { type = 40; }
        var totalBytes = (this.allocList.filter(function (l) { return l; }).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    };
    ASM_Memory.prototype.struct = function (values, type, nested) {
        var _this = this;
        var e = function () {
            throw new Error("Struct can only use arrays of strings and numbers!");
        };
        if (!Array.isArray(values)) {
            e();
        }
        var refs = {};
        var offsets = [];
        var sizeof = values.filter(function (k, i) { return i % 2 === 0; }).reduce(function (p, c, i) {
            var thisSize = (c.split(":")[1] || type);
            if (Array.isArray(values[(i * 2) + 1])) {
                thisSize = "f32";
            }
            offsets.push(p);
            return p + _this.mem[thisSize].BYTES_PER_ELEMENT;
        }, 0);
        var slots = this.malloc(sizeof, "char");
        refs._addr = slots[0];
        refs._length = sizeof;
        refs._keys = values.filter(function (k, i) { return i % 2 === 0; });
        refs._totalLength = sizeof;
        var magicKeys = ["_addr", "_length", "_totalLength", "_keys", "_up"];
        values.forEach(function (i) {
            if (i % 2 === 0) {
                if (typeof values[i] !== "string") {
                    e();
                }
                var key = values[i].split(":").shift();
                var value = values[i + 1];
                var addr = slots[0] + offsets[i / 2];
                if (magicKeys.filter(function (k) { return nested ? (k !== "_up") : true; }).indexOf(key) !== -1) {
                    throw new Error("Can't use any of these keys in struct: " + magicKeys.join(", "));
                }
                if (Array.isArray(value)) {
                    refs[key] = _this.struct(["_up", addr].concat(value), type, true);
                    _this.sizeList[addr] = "f32";
                    _this.set(addr, refs[key]._addr);
                    refs._totalLength += refs[key]._length;
                }
                else if (typeof value === "number") {
                    refs[key] = addr;
                    _this.sizeList[addr] = values[i].split(":")[1] || type;
                    _this.set(refs[key], value || 0, values[i].split(":")[1] || type);
                }
                else {
                    e();
                }
            }
        });
        return refs;
    };
    ASM_Memory.prototype.malloc = function (size, type) {
        var _this = this;
        if (type === void 0) { type = 40; }
        if (typeof size !== "number" || size < 1) {
            throw new Error("Size must be greater than zero and a number!");
        }
        var addresses = [];
        var remainingAdd = size * this.mem[type].BYTES_PER_ELEMENT;
        var mod = this.allocPointer % this.mem[type].BYTES_PER_ELEMENT;
        if (mod) {
            this.allocPointer -= mod;
            this.allocPointer += this.mem[type].BYTES_PER_ELEMENT;
        }
        var _loop_1 = function () {
            var numTries = 0;
            var tryAlloc = function () {
                if (_this.allocPointer >= _this.max) {
                    _this.allocPointer = 0;
                }
                numTries++;
                if (numTries >= _this.max) {
                    throw new Error("Not enough memory left!");
                }
                if (!_this.allocList[_this.allocPointer]) {
                    addresses.push(_this.allocPointer);
                    _this.allocPointer++;
                    if (addresses.length > 1) {
                        if (addresses[addresses.length - 1] - addresses[addresses.length - 2] !== 1) {
                            remainingAdd = size * _this.mem[type].BYTES_PER_ELEMENT;
                            addresses = [];
                        }
                        else {
                            remainingAdd--;
                        }
                    }
                    else {
                        remainingAdd--;
                    }
                }
                else {
                    _this.allocPointer++;
                    numTries % 500 === 0 ? setTimeout(tryAlloc, 0) : tryAlloc();
                }
            };
            tryAlloc();
        };
        while (remainingAdd) {
            _loop_1();
        }
        addresses.forEach(function (a) { _this.allocList[a] = true; });
        var resultAddr = addresses.filter(function (a) { return a % _this.mem[type].BYTES_PER_ELEMENT === 0; });
        resultAddr.forEach(function (addr) {
            _this.sizeList[addr] = type;
        });
        return resultAddr;
    };
    ASM_Memory.prototype.free = function (addr, type) {
        var _this = this;
        if (type === void 0) { type = 40; }
        var freeAlloc = function (start, end) {
            while (start < end) {
                _this.allocList[start] = false;
                start++;
            }
        };
        if (Array.isArray(addr)) {
            addr.forEach(function (a) {
                _this.mem[type][a / _this.mem[type].BYTES_PER_ELEMENT] = 0;
            });
            freeAlloc(addr[0], addr[addr.length - 1] + this.mem[type].BYTES_PER_ELEMENT);
        }
        else {
            addr._keys.forEach(function (key) {
                if (typeof addr[key] === "number") {
                    _this.mem[type][addr[key] / _this.mem[type].BYTES_PER_ELEMENT] = 0;
                }
                else {
                    _this.free(addr[key], type);
                }
            });
            freeAlloc(addr._addr, addr._addr + (addr._length * this.mem[type].BYTES_PER_ELEMENT));
        }
        return this;
    };
    return ASM_Memory;
}());
