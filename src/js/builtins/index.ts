
declare var neutrino: {
    c(code: string): any;
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
    assign(target: object, ...values: object[]): object;
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
        } else if (typeof value === 'boolean') {
            return new Boolean(value);
        } else if (typeof value === 'number') {
            return new Number(value);
        } else if (typeof value === 'string') {
            return new String(value);
        } else {
            throw new TypeError(`Cannot convert ${typeof value} to an object`);
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

Object.assign = function(target, ...values) {
    for (let i = 0; i < values.length; i++) {
        let value = values[i];
        for (let key in value) {
            // @ts-ignore
            target[key] = value[key];
        }
    }
}


interface FunctionConstructor {
    new (...args: any): Function;
    prototype: Function;
}

type Parameters<T extends (...args: any[]) => any> = T extends (...args: infer U) => any ? U : any;
type ReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer U ? U : any;

interface Function extends Object {
    (...args: any[]): any;
    new (...args: any[]): any;
    constructor: FunctionConstructor;
    prototype: object;
    apply(thisArg: any, args: Parameters<this>): ReturnType<this>;
    bind<T>(thisArg: T): (this: T, ...args: Parameters<this>) => ReturnType<this>;
    call<T>(thisArg: T, ...args: Parameters<this>): ReturnType<this>;
}

var Function: FunctionConstructor = {
    // @ts-ignore
    prototype: {
        prototype: {},
        apply(thisArg, args) {
            return neutrino.callFunction(neutrino.currentFunction, thisArg, args);
        },
        bind(thisArg) {
            let func = neutrino.currentFunction;
            return function(...args) {
                return neutrino.callFunction(func, thisArg, args);
            }
        },
        call(thisArg, ...args) {
            return neutrino.callFunction(neutrino.currentFunction, thisArg, args);
        }
    },
};
Function.prototype.constructor = Function;

type CallableFunction = Function;
type NewableFunction = Function;

interface IArguments {
    [index: number]: any;
    length: number;
    callee: Function;
}


interface Boolean {
    constructor: BooleanConstructor;
}

interface BooleanConstructor extends Function {
    (value: any): boolean;
    new (value: any): Boolean;
    prototype: Boolean;
}

// @ts-ignore
var Boolean: BooleanConstructor = function(this: Boolean, value) {
    if (new.target) {
        this.constructor = Boolean;
    } else {
        return !!value;
    }
}

Boolean.prototype = {
    constructor: Boolean,
};


interface Number {
    constructor: NumberConstructor;
}

interface NumberConstructor extends Function {
    (value: any): number;
    new (value: any): Number;
    prototype: Number;
}

// @ts-ignore
var Number: BooleanConstructor = function(this: Number, value) {
    if (new.target) {
        this.constructor = Number;
    } else {
        return 0 + value;
    }
}

Number.prototype = {
    constructor: Number,
};


interface String {
    constructor: StringConstructor;
    length: number;
}

interface StringConstructor extends Function {
    (value: any): string;
    new (value: any): String;
    prototype: String;
}

// @ts-ignore
var String: StringConstructor = function(this: String, value) {
    if (new.target) {
        this.constructor = String;
    } else {
        return 0 + value;
    }
}

String.prototype = {
    constructor: String,
    wrappedPrimitive: string;
    get length() {
        return ``;
    }
};


interface Array<T> extends Object {
    [index: number]: T;
    length: number;
}

interface ArrayConstructor {
    <T>(...values: T[]): Array<T>;
    new <T>(...values: T[]): Array<T>;
    prototype: {
        constructor: ArrayConstructor;
    };
}

// @ts-ignore
var Array: ArrayConstructor = function<T>(this: Array<T>, ...values: T[]) {
    if (!new.target) {
        return new Array(...values);
    } else {
        if (values.length === 1 && typeof values[0] === 'number') {
            return neutrino.c`create_array_of_length(${values[0]})`;
        } else {
            return neutrino.c`create_array(${values.length}, ${values.join(',')})`
        }
    }
}
Array.prototype = {
    constructor: Array,
};
