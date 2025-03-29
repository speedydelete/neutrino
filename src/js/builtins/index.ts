
declare var neutrino: {
    c(strings: string[], ...parts: any): any;
    compiledFunctionName: string;
    currentFunction: Function;
    callFunction(func: Function, thisArg: any, args: any[]): any;
    isObject(value: any): value is object;
};


var Infinity = 1/0;
var NaN = 0/0;
// @ts-ignore
var undefined = void 0;


type PropertyKey = string | number;

interface Object {
    constructor: object | null;
    hasOwnProperty(prop: PropertyKey): boolean;
    isPrototypeOf(object: object): boolean;
    toLocaleString(): string;
    toString(): string;
    valueOf(): any;
}

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

// @ts-ignore
var Object: ObjectConstructor = function(value: any): object {
    if (new.target === undefined) {
        return new Object(value);
    } else {
        if (new.target !== Object) {
            return neutrino.c`create_object(get_key(${new.target}, "prototype"))`;
        } else if (value === null || value === undefined) {
            return neutrino.c`create_object(get_key(${Object}, "prototype"))`;
        } else if (neutrino.isObject(value)) {
            return value;
        } else {
            // @ts-ignore
            return value;
        }
    }
}

Object.prototype = {
    constructor: Object,
    hasOwnProperty(prop) {
        return prop in this && !(prop in neutrino.c`this->prototype`);
    },
    isPrototypeOf(object) {
        return neutrino.c`is_prototype_of(this, ${object})'`;
    },
    toLocaleString() {
        return this.toString();
    },
    toString() {
        return '[object Object]';
    },
    valueOf() {
        return this;
    },
};


interface Function extends Object {
    (...args: any[]): any;
    new (...args: any[]): any;
    prototype: object;
}

type CallableFunction = Function;
type NewableFunction = Function;

interface IArguments {
    [index: number]: any;
    length: number;
    callee: Function;
}


interface Boolean {}

interface Number {
    toString(): string;
    valueOf(): number;
}

interface String {
    length: number;
}


interface Array<T> {
    [index: number]: T;
    length: number;
    constructor: ArrayConstructor;
}

interface ArrayConstructor {
    (length: number): Array<undefined>;
    <T>(...values: T[]): Array<T>;
    new<T>(...values: T[]): Array<T>;
}

declare var Array: ArrayConstructor;

interface TemplateStringsArray extends Array<string> {}


interface RegExp {}
