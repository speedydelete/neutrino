
import {CompilerError, SourceData} from './errors';


export class Scope {

    parent: Scope | null;
    vars: Map<string, Type> = new Map();
    types: Map<string, Type> = new Map();

    constructor(parent?: Scope | null) {
        this.parent = parent ?? null;
    }

    get(name: string, src: SourceData): Type {
        let type = this.vars.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.get(name, src);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, src);
        }
    }

    has(name: string): boolean {
        return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
    }

    set(name: string, type: Type): void {
        this.vars.set(name, type);
    }

    getType(name: string, src: SourceData): Type {
        let type = this.types.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.getType(name, src);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, src);
        }
    }

    hasType(name: string): boolean {
        return this.types.has(name) || (this.parent ? this.parent.hasType(name) : false);
    }

    setType(name: string, type: Type): void {
        this.types.set(name, type);
    }

}


export abstract class Type {

    typeVars: TypeVar[] = [];
    resolvedTypeVars: TypeVar[] = [];

    extends(other: Type): boolean {
        return other.doesExtend(this);
    }

    doesExtend(other: Type): boolean {
        return other === this || other instanceof this.constructor;
    }

    _copy<T extends Type>(out: T): T {
        out.typeVars = this.typeVars;
        out.resolvedTypeVars = this.resolvedTypeVars;
        return out;
    }

    abstract copy(): Type;

    with(typeVars: {[key: string]: Type}): Type {
        let out = this.copy();
        let newTypeVars: TypeVar[] = [];
        for (let i = 0; i < this.typeVars.length; i++) {
            let typeVar = this.typeVars[i];
            if (typeVar.name in typeVars) {
                out.resolvedTypeVars.push(new TypeVar(typeVar.name, typeVar.constraint, typeVars[typeVar.name]));
            } else {
                newTypeVars.push(typeVar);
            }
        }
        out.typeVars = newTypeVars;
        return out;
    }

    abstract toString(): string;

}


export class TypeVar extends Type {

    name: string;
    constraint: Type;
    defaultValue: Type;
    typeVars: [] = [];

    constructor(name: string, constraint?: Type, defaultValue?: Type) {
        super();
        this.name = name;
        this.constraint = constraint ?? new Any();
        this.defaultValue = defaultValue ?? this.constraint;
    }

    extends(other: Type): boolean {
        return other instanceof TypeVar && this.name === other.name && this.constraint.doesExtend(other.constraint) && this.defaultValue.extends(other.defaultValue);
    }

    copy(): TypeVar {
        return super._copy(new TypeVar(this.name, this.constraint, this.defaultValue));
    }

    with(typeVars: {[key: string]: Type}): Type {
        for (let name in typeVars) {
            if (name === this.name) {
                return typeVars[name];
            }
        }
        return this;
    }

    toString(): string {
        return this.name;
    }
}

export type TypeRef<T extends Type = Type> = T & {
    scope: Scope;
    name: string;
    resolve(): T;
};

export let TypeRef = Object.assign(function(this: TypeRef, scope: Scope, name: string) {
    if (!new.target) {
        return new TypeRef(scope, name);
    }
    this.scope = scope;
    this.name = name;
}, {
    prototype: new Proxy(Object.assign(Object.create(Type.prototype), {
        resolve(this: TypeRef, src: SourceData) {
            return this.scope.getType(this.name, src);
        },
        toString(this: TypeRef) {
            return this.name;
        }
    }), {
        
    }),
}) as unknown as {
    new<T extends Type>(scope: Scope, name: string): TypeRef<T>;
    <T extends Type>(scope: Scope, name: string): TypeRef<T>;
};


export abstract class NamedType extends Type {

    abstract name: string;

    doesExtend(other: Type): boolean {
        return other instanceof NamedType && this.name === other.name;
    }

    copy(): NamedType {
        // @ts-ignore
        return new this.constructor();
    }

    toString(): string {
        return this.name;
    }

}

export class Any extends NamedType {
    name: 'any' = 'any';
    extends(): boolean {
        return true;
    }
    doesExtend(): boolean {
        return true;
    }
}

export class Unknown extends NamedType {
    name: 'unknown' = 'unknown';
    doesExtend(): boolean {
        return true;
    }
}

export class Never extends NamedType {
    name: 'never' = 'never';
    extends(): boolean {
        return false;
    }
    doesExtend(): boolean {
        return false;
    }
}


export class Undefined extends NamedType {
    name: 'undefined' = 'undefined';
}

export class Void extends NamedType {
    name: 'void' = 'void';
    doesExtend(other: Type): boolean {
        return other instanceof Undefined || other instanceof Void;
    }
}

export class Null extends NamedType {
    name: 'null' = 'null';
}


export class ValueType<T extends any = any> extends Type {

    value: T;

    constructor(value: T) {
        super();
        this.value = value;
    }

    doesExtend(other: Type): boolean {
        return other instanceof ValueType && other instanceof this.constructor && other.value === this.value;
    }

    toString(): string {
        return String(this.value);
    }

    copy(): ValueType {
        // @ts-ignore
        return new this.constructor(this.value);
    }

}


export class ValueTypeClass<T extends any, Name extends string> extends NamedType {

    name: Name;
    valueClass: typeof ValueType<T>;

    constructor(name: Name, valueClass: typeof ValueType<T>) {
        super();
        this.name = name;
        this.valueClass = valueClass;
    }
    
    extends(other: Type): other is this {
        return other === this;
    }

    doesExtend(other: Type): boolean {
        return other === this || other instanceof this.valueClass;
    }

}

export function createValueType<T extends any, Name extends string>(name: Name, cls?: typeof ValueType<T>): typeof ValueType<T> & {(value: T): ValueType<T>} & ValueTypeClass<T, Name> {
    if (cls === undefined) {
        cls = class extends ValueType<T> {};
    }
    let withValue = new ValueTypeClass(name, cls);
    return new Proxy(cls, {
        get(target, prop, receiver) {
            if (prop in withValue) {
                // @ts-ignore
                return withValue[prop];
            } else {
                return Reflect.get(target, prop, receiver);
            }
        },
        apply(target, thisArg, argArray: [T]) {
            return new cls(argArray[0]);
        },
    }) as any;
}


export const boolean = createValueType<boolean, 'boolean'>('boolean');
export const number = createValueType<number, 'number'>('number');
const ESCAPES: {[key: string]: string} = {
    '\0': '\\0',
    '"': '\\"',
    '\\': '\\\\',
    '\n': '\\n',
    '\r': '\\r',
    '\v': '\\v',
    '\t': '\\t',
    '\b': '\\b',
    '\f': '\\f',
};
export const string = createValueType<string, 'string'>('string', class extends ValueType<string> {
    toString(): string {
        let out = '';
        for (let char of this.value) {
            let code = char.charCodeAt(0);
            if (code >= 0x20 && code < 0x7F) {
                out += char;
            } else if (char in ESCAPES) {
                out += ESCAPES[char];
            } else if (code <= 0xFF) {
                out += '\\x' + code.toString(16).padStart(2, '0');
            } else {
                out += '\\u{' + code.toString(16) + '}';
            }
        }
        return '"' + out + '"';
    }
});
let nextSymbolId = 0;
export const symbol = createValueType<number, 'symbol'>('symbol', class extends ValueType<number> {
    constructor() {
        super(nextSymbolId);
        nextSymbolId++;
    }
    toString() {
        return 'unique symbol';
    }
});
export const bigint = createValueType<bigint, 'bigint'>('bigint');


export interface Parameter {
    name: string;
    type: Type;
}

export interface FunctionData {
    params: Parameter[];
    restParam: Parameter | null;
    returnType: Type;
}

export type Descriptor = ({
    configurable: boolean,
    enumerable: boolean,
} & ({
    writable: boolean,
    value: Type,
} | {
    get: _ObjectType & {call: {params: [], returnType: Type, restParam: null}},
    set?: _ObjectType & {call: {params: [Parameter], returnType: Void, restParam: null}},
}));

export type Properties = {[key: PropertyKey]: Descriptor};

class _ObjectType extends Type {

    props: Properties;
    call?: FunctionData;

    constructor(props: {[key: PropertyKey]: Type} | Properties = {}, call?: FunctionData) {
        super();
        let keys = Object.keys(props);
        if (keys.length === 0) {
            this.props = {};
        } else if (props[keys[0]] instanceof Type) {
            this.props = {};
            for (let [key, type] of Object.entries(props)) {
                this.props[key] = {
                    configurable: true,
                    enumerable: true,
                    value: type,
                    writable: true,
                };
            }
        } else {
            this.props = props as Properties;
        }
        this.call = call;
    }

    copy(): _ObjectType {
        return this.with({});
    }

    with(typeVars: {[key: string]: Type}): _ObjectType {
        let superWith = super.with(typeVars);
        let out = new _ObjectType({});
        out.typeVars = superWith.typeVars;
        out.resolvedTypeVars = superWith.resolvedTypeVars;
        for (let [name, prop] of Object.entries(this.props)) {
            out.props[name] = Object.assign({
                enumerable: prop.enumerable,
                configurable: prop.configurable,
            }, 'value' in prop ? {
                value: prop.value.with(typeVars),
                writable: prop.writable,
            } : {
                get: prop.get,
                set: prop.set,
            });
        }
        if (this.call) {
            out.call = {
                params: this.call.params.map(param => {
                    return {
                        name: param.name,
                        type: param.type.with(typeVars),
                    };
                }),
                restParam: this.call.restParam ? [
                    this.call.restParam.name,
                    this.call.restParam.type.with(typeVars)
                ] as unknown as Parameter : null,
                returnType: this.call.returnType.copy(),
            };
        }
        return out;
    }

    get(key: string | symbol): Type | null {
        if (!(key in this.props)) {
            return null;
        }
        let prop = this.props[key];
        if ('value' in prop) {
            return prop.value;
        } else {
            return prop.get.call.returnType;
        }
    }

    set(key: string | symbol, value: Type): 'complete' | 'not writable' | 'is accessor' {
        if (!(key in this.props)) {
            this.props[key] = {
                configurable: true,
                enumerable: true,
                value: value,
                writable: true,
            };
        } else {
            let prop = this.props[key];
            if ('value' in prop) {
                if (!prop.writable && !prop.configurable) {
                    return 'not writable';
                }
                prop.value = value;
            } else {
                return 'is accessor';
            }
        }
        return 'complete';
    }

    toString(): string {
        let keys = Object.keys(this.props);
        let paramsSig: string | null = null;
        if (this.call) {
            let {params, restParam, returnType} = this.call;
            paramsSig = '(' + this.call.params.map(({name, type}) => `${name}: ${type}`).join(', ');
            if (restParam) {
                paramsSig += `${params.length === 0 ? '' : ', '}...${restParam.name}: ${restParam.type}`;
            }
            paramsSig += ')';
            if (keys.length === 1 && keys[0] === 'prototype') {
                return paramsSig + ' => ' + returnType.toString();
            }
        } else if (keys.length === 0) {
            return '{}';
        }
        if (this.call) {

        }
    }

}

const _object = new class extends Type {
    copy() {
        return this;
    }
    with() {
        return this;
    }
    toString() {
        return 'object';
    }
}

export const object = new Proxy(_ObjectType, {
    get(target, prop, receiver) {
        if (prop in _object) {
            // @ts-ignore
            return _object[prop];
        } else {
            return Reflect.get(target, prop, receiver);
        }
    },
    apply(target, thisArg, argArray: [{[key: PropertyKey]: Type} | Properties | undefined, FunctionData | undefined]) {
        return new _ObjectType(argArray[0]);
    },
}) as typeof _ObjectType & typeof _object;

export const any = new Any();
export const unknown = new Unknown();
export const never = new Never();
const undefined_ = new Undefined();
const void_ = new Void();
const null_ = new Null();
export {
    undefined_ as undefined,
    void_ as void,
    null_ as null,
}
