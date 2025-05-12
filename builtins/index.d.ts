
interface Object {}

interface Function {
    prototype: any;
}

interface Object {
    /* c = object_toString */ toString(): string;
    /* c = object_valueOf */ valueOf(): any;
}

interface IArguments {}


declare var neutrino: {
    argv: string[];
}

declare var Infinity: number;
declare var NaN: number;

/* c = js_global_isNaN, no this */ declare function isNaN(value: number): boolean;
/* c = js_global_isFinite, no this */ declare function isFinite(value: number): boolean;
/* c = js_global_parseFloat, no this */ declare function parseFloat(value: string): number;
/* c = js_global_parseInt, no this */ declare function parseInt(value: string, base?: number /* = 10 */): number;



interface Boolean {
    /* c = boolean_toString */ toString(): string;
    /* c = boolean_valueOf */ valueOf(): boolean;
}

interface Number {
    /* c = number_toString */ toString(): string;
    /* c = number_valueOf */ valueOf(): number;
}

interface String {
    length: number;
    /* c = string_toString */ toString(): string;
    /* c = string_valueOf */ valueOf(): string;
    /* c = string_at */ at(index: number): string;
    /* c = string_charAt */ charAt(index: number): string;
    /* c = string_endsWith */ endsWith(other: string): boolean;
    /* c = string_includes */ includes(other: string): boolean;
    /* c = string_indexOf */ indexOf(other: string): number;
    /* c = string_lastIndexOf */ lastIndexOf(other: string): number;
    /* c = string_padEnd */ padEnd(length: number, str?: string /* = ' ' */): string;
    /* c = string_padStart */ padStart(length: number, str?: string /* = ' ' */): string;
    /* c = string_repeat */ repeat(times: number): string;
    /* c = string_replace */ replace(old: string, newStr: string): string;
    /* c = string_replaceAll */ replaceAll(old: string, newStr: string): string;
    /* c = string_slice */ slice(start /* = 0 */?: number, end /* = 0 */?: number): string;
    /* c = string_substring */ substring(start: number, length: number): string;
    /* c = string_toLowerCase */ toLowerCase(): string;
    /* c = string_toUpperCase */ toUpperCase(): string;
    /* c = string_trim */ trim(): string;
    /* c = string_trimEnd */ trimEnd(): string;
    /* c = string_trimStart */ trimStart(): string;
}

interface Symbol {
    /* c = symbol_toString */ toString(): string;
    /* c = symbol_valueOf */ valueOf(): symbol;
}

interface BigInt {}

declare var Boolean: /* no this */ (x: any) => boolean;
declare var Number: /* no this */ (x: any) => number;
declare var String: /* no this */ (x: any) => string;
declare var Symbol: /* no this */ () => symbol;


interface Array<T> {
    [index: number]: T;
    length: number;
    /* c = array_toString */ toString(): string;
    /* c = array_valueOf */ valueOf(): T[];
    /* c = array_at */ at(index: number): T;
    /* c = array_copyWithin */ copyWithin(target: number, start: number, end: number): T[];
    /* c = array_every */ every(func: (item: T) => boolean): boolean;
    /* c = array_fill */ fill(value: T): T[];
    /* c = array_filter */ filter(func: (item: T) => boolean): T[];
    /* c = array_find */ find(func: (item: T) => boolean): T;
    /* c = array_findIndex */ findIndex(func: (item: T) => boolean): number;
    /* c = array_findLast */ findLast(func: (item: T) => boolean): T;
    /* c = array_findLastIndex */ findLastIndex(func: (item: T) => boolean): number;
    /* c = array_flat */ flat(): T[];
    /* c = array_flatMap */ flatMap(func: (item: T) => any): any[];
    /* c = array_forEach */ forEach(func: (item: T) => any): void;
    /* c = array_includes */ includes(item: T): boolean;
    /* c = array_indexOf */ indexOf(item: T): number;
    /* c = array_join */ join(sep /* = ',' */?: string): string;
    /* c = array_lastIndexOf */ lastIndexOf(item: T): number;
    /* c = array_map */ map(func: (item: T) => any): any[];
    /* c = array_pop */ pop(): T | undefined;
    /* c = array_push */ push(value: T): T[];
    /* c = array_reduce */ reduce(func: (a: T, b: T) => any): any;
    /* c = array_reduceRight */ reduceRight(func: (a: T, b: T) => any): any;
    /* c = array_shift */ shift(): T;
    /* c = array_slice */ slice(start: number, end: number): T[];
    /* c = array_some */ some(func: (item: T) => boolean): boolean;
    /* c = array_push */ push(value: T): void;
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


interface Console {
    /* c = console_log, no this, real void */ log(message: string): void;
    /* c = console_input, no this, real void */ input(prompt: string): string;
}

declare var console: Console;
