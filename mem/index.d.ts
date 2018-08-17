/// <reference path="webassembly.d.ts" />
declare const Promise: any;
interface ASM_Module {
    exports: {
        [key: string]: any;
    };
    memory: WebAssembly.Memory;
    memoryManager: ASM_Memory;
    table: WebAssembly.Table;
}
interface MemoryObj {
    _addr: number;
    _keys: string[];
    _up: number;
    _length: number;
    _totalLength: number;
    [key: string]: any;
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
    scan(): void;
    set(addr: number, value: number, type?: 1 | 2 | 4 | 40 | 80): this;
    get(addr: number, type?: 1 | 2 | 4 | 40 | 80): number;
    avail(type?: 1 | 2 | 4 | 40 | 80): number;
    struct(values: any[], type?: 1 | 2 | 4 | 40 | 80, nested?: boolean): MemoryObj;
    malloc(size: number, type?: 1 | 2 | 4 | 40 | 80): number[];
    free(addr: number[] | MemoryObj, type?: 1 | 2 | 4 | 40 | 80): this;
}
