/// <reference path="webassembly.d.ts" />

declare const Promise: any;

interface ASM_Module {
    exports: {[key: string]: any},
    memory: WebAssembly.Memory,
    memoryManager: ASM_Memory,
    table: WebAssembly.Table
}

interface MemoryObj {
    _addr: number;
    _keys: string[];
    _up: number;
    _length: number;
    _totalLength: number;
    [key: string]: any;
}

class ASM_Memory {

    //public m: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
    public mem: {
        char: Int8Array,
        1: Int8Array,
        short: Int16Array,
        2: Int16Array,
        int: Int32Array,
        4: Int32Array,
        float: Float32Array,
        40: Float32Array,
        double: Float64Array
        80: Float64Array,
    };

    public allocList: boolean[];

    public allocPointer: number;

    private max: number;

    constructor(buffer: ArrayBuffer) {
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

    public scan() {
        this.mem.char.forEach((val, i) => {
            if (val > 0) {
                this.allocPointer = i;
                this.allocList[i] = true;
            }
        })
    }

    public set(addr: number, value: number, type: 1|2|4|40|80 = 40): this {
        if (typeof addr !== "number" || typeof value !== "number") {
            throw new Error("Address & value must be a number!");
        }
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    }

    public get(addr: number, type: 1|2|4|40|80 = 40): number {
        if (typeof addr !== "number") {
            throw new Error("Address must be a number!");
        }
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    }

    public avail(type: 1|2|4|40|80 = 40): number {
        const totalBytes = (this.allocList.filter(l => l).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    }

    public struct(values: any[], type?: 1|2|4|40|80, nested?: boolean): MemoryObj {
        if (!Array.isArray(values)) {
            throw new Error("Struct must use array to initialize!");
        }
        let refs: any = {};
        let slots = this.malloc(values.length / 2, type);

        refs._addr = slots[0];
        refs._length = values.length / 2;
        refs._keys = values.filter((k, i) => i % 2 === 0);
        refs._totalLength = values.length / 2;

        const e = () => {
            throw new Error("Struct can only use arrays of strings and numbers!");
        }

        const magicKeys = ["_addr", "_length", "_totalLength", "_keys", "_up"];

        values.forEach((i) => {
            if (i % 2 === 0) {
                let key: string = values[i];
                
                if (typeof key !== "string") {
                    e();
                }

                if (magicKeys.filter(k => nested ? (k !== "_up") : true).indexOf(key) !== -1) {
                    throw new Error("Can't use any of these keys in struct: " + magicKeys.join(", "));
                }

                if (Array.isArray(values[i + 1])) {
                    refs[key] = this.struct(["_up", slots[i / 2]].concat(values[i + 1]), type, true);
                    this.set(slots[i / 2], refs[key]._addr);
                    refs._totalLength += refs[key]._length;

                } else if (typeof values[i + 1] === "number") {
                    refs[key] = slots[i / 2];
                    this.set(refs[key], values[i + 1] || 0);
                } else {
                    e();
                }
            }
        });
        return refs;
    }

    public malloc(size: number, type: 1|2|4|40|80 = 40): number[] {
        if (typeof size !== "number" || size < 1) {
            throw new Error("Size must be greater than zero and a number!");
        }
        let addresses: number[] = [];
        let remainingAdd = size * this.mem[type].BYTES_PER_ELEMENT;

        const mod = this.allocPointer % this.mem[type].BYTES_PER_ELEMENT;
        if (mod) {
            this.allocPointer -= mod;
            this.allocPointer += this.mem[type].BYTES_PER_ELEMENT;
        }
        
        while (remainingAdd) {
            let numTries = 0;
            const tryAlloc = () => {
                if (this.allocPointer >= this.max) {
                    this.allocPointer = 0;
                }
                numTries++;
                if (numTries >= this.max) {
                    throw new Error("Not enough memory left!");
                }

                if (!this.allocList[this.allocPointer]) {
                    addresses.push(this.allocPointer);
                    this.allocPointer++;
                    if (addresses.length > 1) {
                        // addresses are not contiguious
                        if (addresses[addresses.length - 1] - addresses[addresses.length - 2] !== 1) {
                            remainingAdd = size * this.mem[type].BYTES_PER_ELEMENT;
                            addresses = [];
                        } else {
                            remainingAdd--;
                        }
                    } else {
                        remainingAdd--;
                    }
                    
                } else {
                    this.allocPointer++;
                    numTries % 500 === 0 ? setTimeout(tryAlloc, 0) : tryAlloc(); // fix maximum call stack error
                }
            }
            tryAlloc();
        }

        addresses.forEach(a => { this.allocList[a] = true });

        return addresses.filter(a => a % this.mem[type].BYTES_PER_ELEMENT === 0);
    }

    public free(addr: number[]|MemoryObj, type: 1|2|4|40|80 = 40): this {

        const freeAlloc = (start: number, end: number) => {
            while (start < end) {
                this.allocList[start] = false;
                start++;
            }
        }

        if (Array.isArray(addr)) {
            addr.forEach((a) => {
                this.mem[type][a / this.mem[type].BYTES_PER_ELEMENT] = 0;
            })
    
            freeAlloc(addr[0], addr[addr.length - 1] + this.mem[type].BYTES_PER_ELEMENT);
        } else {
            addr._keys.forEach((key) => {
                if (typeof addr[key] === "number") {
                    this.mem[type][addr[key] / this.mem[type].BYTES_PER_ELEMENT] = 0;
                } else {
                    this.free(addr[key] as any, type);
                }
            });
    
            freeAlloc(addr._addr, addr._addr + (addr._length * this.mem[type].BYTES_PER_ELEMENT));
        }
        return this;
    }
}
