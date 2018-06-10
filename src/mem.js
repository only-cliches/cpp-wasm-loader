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
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    };
    ASM_Memory.prototype.get = function (addr, type) {
        if (type === void 0) { type = 40; }
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    };
    ASM_Memory.prototype.getRange = function (addr, len, type) {
        if (type === void 0) { type = 40; }
        return this.mem[type].slice(addr, addr + (len * this.mem[type].BYTES_PER_ELEMENT));
    };
    ASM_Memory.prototype.avail = function (type) {
        if (type === void 0) { type = 40; }
        var totalBytes = (this.allocList.filter(function (l) { return l; }).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    };
    ASM_Memory.prototype.malloc = function (size, type) {
        var _this = this;
        if (type === void 0) { type = 40; }
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
                    numTries % 1000 === 0 ? setTimeout(tryAlloc, 0) : tryAlloc();
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
        addr.forEach(function (a) {
            _this.mem[type][a / _this.mem[type].BYTES_PER_ELEMENT] = 0;
        });
        var start = addr[0];
        var end = addr[addr.length - 1] + this.mem[type].BYTES_PER_ELEMENT;
        while (start < end) {
            this.allocList[start] = false;
            start++;
        }
        return this;
    };
    return ASM_Memory;
}());
