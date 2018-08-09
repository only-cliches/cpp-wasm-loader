"use strict";
var ASM_Memory = (function () {
    function ASM_Memory(buffer) {
        this.allocList = [];
        this.allocPointer = 0;
        this.mem = {
            1: new Int8Array(0),
            2: new Int16Array(0),
            4: new Int32Array(0),
            40: new Float32Array(0),
            80: new Float64Array(0),
            char: new Int8Array(buffer),
            short: new Int16Array(buffer),
            int: new Int32Array(buffer),
            float: new Float32Array(buffer),
            double: new Float64Array(buffer)
        };
        this.mem[1] = this.mem.char;
        this.mem[2] = this.mem.short;
        this.mem[4] = this.mem.int;
        this.mem[40] = this.mem.float;
        this.mem[80] = this.mem.double;
        this.max = buffer.byteLength - 1;
    }
    ASM_Memory.prototype.set = function (addr, value, type) {
        if (type === void 0) { type = 40; }
        if (typeof addr !== "number" || typeof value !== "number") {
            throw new Error("Address & value must be a number!");
        }
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    };
    ASM_Memory.prototype.get = function (addr, type) {
        if (type === void 0) { type = 40; }
        if (typeof addr !== "number") {
            throw new Error("Address must be a number!");
        }
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    };
    ASM_Memory.prototype.avail = function (type) {
        if (type === void 0) { type = 40; }
        var totalBytes = (this.allocList.filter(function (l) { return l; }).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    };
    ASM_Memory.prototype.struct = function (values, type, nested) {
        var _this = this;
        if (!Array.isArray(values)) {
            throw new Error("Struct must use array to initialize!");
        }
        var refs = {};
        var slots = this.malloc(values.length / 2, type);
        refs._addr = slots[0];
        refs._length = values.length / 2;
        refs._keys = values.filter(function (k, i) { return i % 2 === 0; });
        refs._totalLength = values.length / 2;
        var e = function () {
            throw new Error("Struct can only use arrays of strings and numbers!");
        };
        var magicKeys = ["_addr", "_length", "_totalLength", "_keys", "_up"];
        values.forEach(function (i) {
            if (i % 2 === 0) {
                var key = values[i];
                if (typeof key !== "string") {
                    e();
                }
                if (magicKeys.filter(function (k) { return nested ? (k !== "_up") : true; }).indexOf(key) !== -1) {
                    throw new Error("Can't use any of these keys in struct: " + magicKeys.join(", "));
                }
                if (Array.isArray(values[i + 1])) {
                    refs[key] = _this.struct(["_up", slots[i / 2]].concat(values[i + 1]), type, true);
                    _this.set(slots[i / 2], refs[key]._addr);
                    refs._totalLength += refs[key]._length;
                }
                else if (typeof values[i + 1] === "number") {
                    refs[key] = slots[i / 2];
                    _this.set(refs[key], values[i + 1] || 0);
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
        return addresses.filter(function (a) { return a % _this.mem[type].BYTES_PER_ELEMENT === 0; });
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
