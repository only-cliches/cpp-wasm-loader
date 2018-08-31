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
        uchar: Uint8Array;
        1: Int8Array;
        short: Int16Array;
        ushort: Uint16Array;
        2: Int16Array;
        int: Int32Array;
        uint: Uint32Array;
        4: Int32Array;
        float: Float32Array;
        40: Float32Array;
        double: Float64Array;
        80: Float64Array;
        i8: Int8Array;
        i16: Int16Array;
        i32: Int32Array;
        f32: Float32Array;
        f64: Float64Array;
    };
    allocList: boolean[];
    sizeList: (string | number)[];
    allocPointer: number;
    private max;
    constructor(buffer: ArrayBuffer);
    mark(stackTop: number): void;
    scan(): void;
    set(addr: number, value: number, type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64"): this;
    get(addr: number, type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64"): number;
    avail(type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64"): number;
    struct(values: any[], type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64", nested?: boolean): MemoryObj;
    malloc(size: number, type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64"): number[];
    free(addr: number[] | MemoryObj, type?: 1 | 2 | 4 | 40 | 80 | "char" | "short" | "int" | "float" | "double" | "uint" | "uchar" | "ushort" | "i8" | "i16" | "i32" | "f32" | "f64"): this;
}
