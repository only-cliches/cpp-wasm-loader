class ASM_Memory {

    public m: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

    public allocList: boolean[];

    public allocPointer: number;

    public b: number;

    private max: number;

    constructor(buffer: ArrayBuffer) {
        this.allocList = [];
        this.allocPointer = 0;
        this.b = 4 // bytes;
        this.m = new Float32Array(buffer);
        this.max = this.m.length / this.b;
        /*switch (type) {
            case "char":
            case "int8":
                this.b = 1 // bytes;
                this.m = new Int8Array(buffer);
                break;
            case "uchar":
            case "uint8":
                this.b = 1 // bytes;
                this.m = new Uint8Array(buffer);
                break;
            case "short":
            case "int16":
                this.b = 2 // bytes;
                this.m = new Int16Array(buffer);
                break;
            case "ushort":
            case "uint16":
                this.b = 2 // bytes;
                this.m = new Uint16Array(buffer);
                break;
            case "int":
            case "int32":
                this.b = 4 // bytes;
                this.m = new Int32Array(buffer);
                break;
            case "uint":
            case "uint32":
                this.b = 4 // bytes;
                this.m = new Uint32Array(buffer);
                break;
            case "float":
            case "float32":
                this.b = 4 // bytes;
                this.m = new Float32Array(buffer);
                break;
            case "double":
            case "float64":
            default:
                this.b = 8; // bytes
                this.m = new Float64Array(buffer);
        }*/
    }

    public set(addr: number, value: number) {
        this.m[addr / this.b] = value;
        return this;
    }

    public get(addr: number): number {
        return this.m[addr / this.b];
    }

    public malloc(size: number): number[] {
        let addresses: number[] = [];
        let remainingAdd = size;
        while (remainingAdd) {
            let numTries = 0;

            const tryAlloc = () => {
                if (this.allocPointer >= this.max) {
                    this.allocPointer = 0;
                }
                numTries++;
                if (numTries >= this.max) {
                    throw new Error("No memory left!");
                }

                if (!this.allocList[this.allocPointer]) {
                    addresses.push(this.allocPointer * this.b);
                    this.allocList[this.allocPointer] = true;
                    this.allocPointer++;
                    remainingAdd--;
                } else {
                    this.allocPointer++;
                    tryAlloc();
                }
            }
            tryAlloc();

        }
        return addresses;
    }

    public free(addr: number[]): this {
        addr.forEach((a) => {
            this.allocList[a / this.b] = false;
            this.m[a / this.b] = 0;
        })
        return this;
    }
}
