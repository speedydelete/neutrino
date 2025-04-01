
type PropertyKey = string | number;

interface Object {
    constructor: object | null;
    hasOwnProperty(prop: PropertyKey): boolean;
    isPrototypeOf(object: object): boolean;
    toLocaleString(): string;
    toString(): string;
    valueOf(): any;
}

interface Array<T> {
    [index: number]: T;
    length: number;
}

type TemplateStringsArray = string[];

interface Function extends Object {
    (...args: any[]): any;
    new (...args: any[]): any;
    prototype: object;
}

declare var neutrino: {
    c(strings: string[], ...parts: any): any;
};


var Infinity = 1/0;
var NaN = 0/0;
// @ts-ignore
var undefined = neutrino.c`NULL` as undefined;


type CallableFunction = Function;
type NewableFunction = Function;

type IArguments = never;


interface ObjectConstructor {
    (value: any): object;
    new (value: any): object;
    prototype: Object;
    assign<T extends object, U extends object>(target: T, value1: U): T & U;
    assign<T extends object, U extends object, V extends object>(target: T, value1: U, value2: V): T & U & V;
    create(proto: object | null): object;
    entries(obj: object): [PropertyKey, any][];
    fromEntries(iterable: [PropertyKey, any][]): object;
    getOwnPropertyNames(obj: object): string[];
    getPrototypeOf(obj: object): object | null;
    hasOwn(obj: object, prop: PropertyKey): boolean;
    is(value1: any, value2: any): boolean;
    keys(obj: object): string[];
    setPrototypeOf(obj: object, proto: object | null): void;
    values(obj: object): any[];
}

// declare var Object: ObjectConstructor;
// // @ts-ignore
// Object = function(value: any): object {
//     if (new.target === undefined) {
//         return new Object(value);
//     } else {
//         if (new.target !== Object) {
//             return neutrino.c`create_object(get_key(${new.target}, "prototype"))`;
//         } else if (value === null || value === undefined) {
//             return neutrino.c`create_object(get_key(${Object}, "prototype"))`;
//         } else if (typeof value === 'object' || typeof value === 'function') {
//             return value;
//         } else {
//             // @ts-ignore
//             return value;
//         }
//     }
// }

// Object.prototype = {
//     constructor: Object,
//     hasOwnProperty(prop) {
//         return prop in this && !(prop in neutrino.c`this->prototype`);
//     },
//     isPrototypeOf(object) {
//         return neutrino.c`is_prototype_of(this, ${object})'`;
//     },
//     toLocaleString() {
//         return this.toString();
//     },
//     toString() {
//         return '[object Object]';
//     },
//     valueOf() {
//         return this;
//     },
// };


// class Error {
//     type: string;
//     message: string;
//     constructor(message?: string) {
//         this.type = 'Error';
//         this.message = message ?? '';
//     }
//     toString() {
//         return `${this.type}: ${this.message}`;
//     }
// }

// class ReferenceError extends Error {
//     constructor(message?: string) {
//         super(message);
//         this.type = 'ReferenceError';
//     }
// }

// class TypeError extends Error {
//     constructor(message?: string) {
//         super(message);
//         this.type = 'TypeError';
//     }
// }


interface Boolean {}

// function Boolean(value: any): boolean {
//     return value !== undefined && value !== null && value !== 0 && value === value && value !== '';
// }


interface Number {
    toString(): string;
    valueOf(): number;
}

// function parseInt(value: string): number {
//     return neutrino.c`atoi(${value})`;
// }

// function parseFloat(value: string): number {
//     return neutrino.c`atof(${value})`;
// }

// function Number(value: any): number {
//     if (value === undefined || value === null) {
//         return 0;
//     } else if (typeof value === 'boolean') {
//         return neutrino.c`${value}`;
//     } else if (typeof value === 'number') {
//         return value;
//     } else if (typeof value === 'string') {
//         return parseFloat(value);
//     } else if (typeof value === 'symbol') {
//         return -1;
//         // throw new TypeError('Cannot convert symbol to number');
//     } else if (typeof value === 'bigint') {
//         return -1;
//         // throw new TypeError('Cannot convert BigInt to number');
//     } else {
//         return neutrino.c`${Number}(object_to_primitive(value))`;
//     }
// }


interface String {
    length: number;
}

// function String(value: any): string {
//     if (value === undefined) {
//         return 'undefined';
//     } else if (value === null) {
//         return 'null';
//     } else if (value === true) {
//         return 'true';
//     } else if (value === false) {
//         return 'false';
//     } else if (typeof value === 'number') {
//         return neutrino.c`itoa(${value})`;
//     } else {
//         return neutrino.c`${String}(object_to_primitive(value))`;
//     }
// }


// function Array<T>(...items: T[]): Array<T> {
//     return items;
// }


// const console = {
//     log(data: string): void {
//         neutrino.c`printf(${data})`;
//     }
// };


interface RegExp {}
