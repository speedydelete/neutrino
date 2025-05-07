
declare var neutrino: {
    argv: string[];
}

declare var Infinity: number;
declare var NaN: number;

/* no this */ declare function isNaN(value: number): boolean;
/* no this */ declare function isFinite(value: number): boolean;
/* no this */ declare function parseFloat(value: string): number;
/* no this */ declare function parseInt(value: string, base?: number /* = 10 */): number;


interface Object {
    toString(): string;
}

interface Function {}
interface IArguments {}
interface Boolean {}
interface BigInt {}
interface Symbol {}

declare var Boolean: (x: any) => boolean;
declare var Number: (x: any) => number;
declare var String: (x: any) => string;
declare var Symbol: () => symbol;

interface Number {

}

interface String {
    length: number;
    at(index: number): string;
    charAt(index: number): string;
    endsWith(other: string): boolean;
    includes(other: string): boolean;
    indexOf(other: string): number;
    lastIndexOf(other: string): number;
    padEnd(length: number, str?: string /* = ' ' */): string;
    padStart(length: number, str?: string /* = ' ' */): string;
    repeat(times: number): string;
    replace(old: string, newStr: string): string;
    replaceAll(old: string, newStr: string): string;
    slice(start?: number /* = 0 */, end?: number /* = 0 */): string;
    substring(start: number, length: number): string;
    toLowerCase(): string;
    toUpperCase(): string;
    trim(): string;
    trimEnd(): string;
    trimStart(): string;
}

interface Array<T> {
    [index: number]: T;
}

interface RegExp {
    
}


interface Math {
    readonly E: number;
    readonly LN10: number;
    readonly LN2: number;
    readonly LOG10E: number;
    readonly PI: number;
    readonly SQRT1_2: number;
    /* no this */ abs(x: number): number;
    /* no this */ acos(x: number): number;
    /* no this */ acosh(x: number): number;
    /* no this */ asin(x: number): number;
    /* no this */ asinh(x: number): number;
    /* no this */ atan(x: number): number;
    /* no this */ atan2(x: number, y: number): number;
    /* no this */ atanh(x: number): number;
    /* no this */ cbrt(x: number): number;
    /* no this */ clz32(x: number): number;
    /* no this */ cos(x: number): number;
    /* no this */ cosh(x: number): number;
    /* no this */ exp(x: number): number;
    /* no this */ expm1(x: number): number;
    /* no this */ floor(x: number): number;
    /* no this */ f16round(x: number): number;
    /* no this */ fround(x: number): number;
    /* no this */ hypot(x: number): number;
    /* no this */ imul(x: number): number;
    /* no this */ log(x: number): number;
    /* no this */ log10(x: number): number;
    /* no this */ log1p(x: number): number;
    /* no this */ log2(x: number): number;
    /* no this */ max(values: number[]): number;
    /* no this */ min(values: number[]): number;
    /* no this */ pow(x: number, y: number): number;
    /* no this */ random(): number;
    /* no this */ round(x: number): number;
    /* no this */ sin(x: number): number;
    /* no this */ sinh(x: number): number;
    /* no this */ sqrt(x: number): number;
    /* no this */ sumPrecise(values: number[]): number;
    /* no this */ tan(x: number): number;
    /* no this */ tanh(x: number): number;
    /* no this */ trunc(x: number): number;
}

declare var Math: Math;


declare var console: {
    /* no this */ log(message: string): void;
    /* no this */ input(prompt: string): string;
}
