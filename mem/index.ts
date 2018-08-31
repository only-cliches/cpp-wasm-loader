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

    public mem: {
        char: Int8Array,
        uchar: Uint8Array,
        1: Int8Array,
        short: Int16Array,
        ushort: Uint16Array
        2: Int16Array,
        int: Int32Array,
        uint: Uint32Array,
        4: Int32Array,
        float: Float32Array,
        40: Float32Array,
        double: Float64Array
        80: Float64Array,
        i8: Int8Array,
        i16: Int16Array,
        i32: Int32Array,
        f32: Float32Array,
        f64: Float64Array,
    };

    public allocList: boolean[];

    public sizeList: (string|number)[];

    public allocPointer: number;

    private max: number;

    constructor(buffer: ArrayBuffer) {
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
            char: new Int8Array(buffer), // 1 byte, +/- 128
            uchar: new Uint8Array(buffer), // 1 byte, 0 - 255
            short: new Int16Array(buffer), // 2 bytes, +/- 32,767
            ushort: new Uint16Array(buffer), // 2 bytes, 0 - 65,534
            int: new Int32Array(buffer), // 4 bytes, +/- 2,147,483,647
            uint: new Uint32Array(buffer), // 4 bytes, 0 - 4,294,967,294
            float: new Float32Array(buffer), // 4 bytes, insane range
            double: new Float64Array(buffer) // 8 bytes, even more insane range
        };
        this.max = buffer.byteLength - 1;
    }

    public mark(stackTop: number): void {
        for (let i = 0; i <= stackTop; i++) {
            this.allocPointer = i;
            this.allocList[i] = true;
        }
    }

    public scan() {
        this.mem.char.forEach((val, i) => {
            if (val > 0) {
                this.allocPointer = i;
                this.allocList[i] = true;
            }
        })
    }

    public set(addr: number, value: number, type: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64" = 40): this {
        if (typeof addr !== "number" || typeof value !== "number") {
            throw new Error("Address & value must be a number!");
        }
        type = (this.sizeList[addr] || type) as any;
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    }

    public get(addr: number, type: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64" = 40): number {
        if (typeof addr !== "number") {
            throw new Error("Address must be a number!");
        }
        type = (this.sizeList[addr] || type) as any;
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    }

    public avail(type: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64" = 40): number {
        const totalBytes = (this.allocList.filter(l => l).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    }

    public struct(values: any[], type?: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64", nested?: boolean): MemoryObj {
        const e = () => {
            throw new Error("Struct can only use arrays of strings and numbers!");
        }

        if (!Array.isArray(values)) {
            e();
        }
        let refs: any = {};
        let offsets: number[] = [];
        let sizeof = values.filter((k, i) => i % 2 === 0).reduce((p, c, i) => {
            let thisSize = (c.split(":")[1] || type);
            if (Array.isArray(values[(i * 2) + 1])) {
                thisSize = "f32";
            }
            offsets.push(p);
            return p + this.mem[thisSize as "f32"].BYTES_PER_ELEMENT;
        }, 0);
        let slots = this.malloc(sizeof, "char");

        refs._addr = slots[0];
        refs._length = sizeof;
        refs._keys = values.filter((k, i) => i % 2 === 0);
        refs._totalLength = sizeof;

        const magicKeys = ["_addr", "_length", "_totalLength", "_keys", "_up"];

        values.forEach((i) => {
            if (i % 2 === 0) {
                if (typeof values[i] !== "string") {
                    e();
                }

                const key: string = values[i].split(":").shift();
                const value: number = values[i + 1];
                const addr = slots[0] + offsets[i / 2];
                
                if (magicKeys.filter(k => nested ? (k !== "_up") : true).indexOf(key) !== -1) {
                    throw new Error("Can't use any of these keys in struct: " + magicKeys.join(", "));
                }

                if (Array.isArray(value)) {
                    refs[key] = this.struct(["_up", addr].concat(value), type, true);
                    this.sizeList[addr] = "f32";
                    this.set(addr, refs[key]._addr);
                    refs._totalLength += refs[key]._length;
                } else if (typeof value === "number") {
                    refs[key] = addr;
                    this.sizeList[addr] = values[i].split(":")[1] || type;
                    this.set(refs[key], value || 0, values[i].split(":")[1] || type);
                } else {
                    e();
                }
            }
        });
        return refs;
    }

    public malloc(size: number, type: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64" = 40): number[] {
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

        const resultAddr = addresses.filter(a => a % this.mem[type].BYTES_PER_ELEMENT === 0);

        resultAddr.forEach((addr) => {
            this.sizeList[addr] = type;
        });

        return resultAddr;
    }

    public free(addr: number[]|MemoryObj, type: 1|2|4|40|80|"char"|"short"|"int"|"float"|"double"|"uint"|"uchar"|"ushort"|"i8"|"i16"|"i32"|"f32"|"f64" = 40): this {

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
