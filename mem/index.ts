/// <reference path="webassembly.d.ts" />

interface ASM_Module {
    exports: {[key: string]: any},
    memory: WebAssembly.Memory,
    memoryManager: ASM_Memory,
    table: WebAssembly.Table
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

    public set(addr: number, value: number, type: 1|2|4|40|80 = 40): this {
        this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT] = value;
        return this;
    }

    public get(addr: number, type: 1|2|4|40|80 = 40): number {
        return this.mem[type][addr / this.mem[type].BYTES_PER_ELEMENT];
    }

    public getRange(addr: number, len: number, type: 1|2|4|40|80 = 40): Int8Array|Int16Array|Int32Array|Float32Array|Float64Array {
        return this.mem[type].slice(addr, addr + (len * this.mem[type].BYTES_PER_ELEMENT));
    }

    public avail(type: 1|2|4|40|80 = 40): number {
        const totalBytes = (this.allocList.filter(l => l).length - this.mem.char.byteLength);
        return totalBytes / this.mem[type].BYTES_PER_ELEMENT;
    }

    public malloc(size: number, type: 1|2|4|40|80 = 40): number[] {
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
                    numTries % 1000 === 0 ? setTimeout(tryAlloc, 0) : tryAlloc(); // fix maximum call stack error
                }
            }
            tryAlloc();
        }

        addresses.forEach(a => { this.allocList[a] = true });

        return addresses.filter(a => a % this.mem[type].BYTES_PER_ELEMENT === 0);
    }

    public free(addr: number[], type: 1|2|4|40|80 = 40): this {
        addr.forEach((a) => {
            this.mem[type][a / this.mem[type].BYTES_PER_ELEMENT] = 0;
        })

        let start = addr[0];
        const end = addr[addr.length - 1] + this.mem[type].BYTES_PER_ELEMENT;

        while (start < end) {
            this.allocList[start] = false;
            start++;
        }
        
        return this;
    }
}
