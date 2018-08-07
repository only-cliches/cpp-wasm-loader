/// <reference path="webassembly.d.ts" />
interface ASM_Module {
    exports: {
        [key: string]: any;
    };
    memory: WebAssembly.Memory;
    memoryManager: ASM_Memory;
    table: WebAssembly.Table;
}
declare class ASM_Memory {
    mem: {
        char: Int8Array;
        1: Int8Array;
        short: Int16Array;
        2: Int16Array;
        int: Int32Array;
        4: Int32Array;
        float: Float32Array;
        40: Float32Array;
        double: Float64Array;
        80: Float64Array;
    };
    allocList: boolean[];
    allocPointer: number;
    private max;
    constructor(buffer: ArrayBuffer);
    set(addr: number, value: number, type?: 1 | 2 | 4 | 40 | 80): this;
    get(addr: number, type?: 1 | 2 | 4 | 40 | 80): number;
    getRange(addr: number, len: number, type?: 1 | 2 | 4 | 40 | 80): Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
    avail(type?: 1 | 2 | 4 | 40 | 80): number;
    malloc(size: number, type?: 1 | 2 | 4 | 40 | 80): number[];
    free(addr: number[], type?: 1 | 2 | 4 | 40 | 80): this;
}
