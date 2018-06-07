"use strict";
var ASM_Memory = (function () {
    function ASM_Memory(buffer) {
        this.allocList = [];
        this.allocPointer = 0;
        this.b = 4;
        this.m = new Float32Array(buffer);
        this.max = this.m.length / this.b;
    }
    ASM_Memory.prototype.set = function (addr, value) {
        this.m[addr / this.b] = value;
        return this;
    };
    ASM_Memory.prototype.get = function (addr) {
        return this.m[addr / this.b];
    };
    ASM_Memory.prototype.malloc = function (size) {
        var _this = this;
        var addresses = [];
        var remainingAdd = size;
        var _loop_1 = function () {
            var numTries = 0;
            var tryAlloc = function () {
                if (_this.allocPointer >= _this.max) {
                    _this.allocPointer = 0;
                }
                numTries++;
                if (numTries >= _this.max) {
                    throw new Error("No memory left!");
                }
                if (!_this.allocList[_this.allocPointer]) {
                    addresses.push(_this.allocPointer * _this.b);
                    _this.allocList[_this.allocPointer] = true;
                    _this.allocPointer++;
                    remainingAdd--;
                }
                else {
                    _this.allocPointer++;
                    tryAlloc();
                }
            };
            tryAlloc();
        };
        while (remainingAdd) {
            _loop_1();
        }
        return addresses;
    };
    ASM_Memory.prototype.free = function (addr) {
        var _this = this;
        addr.forEach(function (a) {
            _this.allocList[a / _this.b] = false;
            _this.m[a / _this.b] = 0;
        });
        return this;
    };
    return ASM_Memory;
}());
