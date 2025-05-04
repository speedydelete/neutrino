
import type * as b from '@babel/types';
import {CompilerError} from './errors';
import {highlight, HighlightColors} from './highlighter';


export class Scope {

    parent: Scope | null;
    vars: Map<string, Type> = new Map();
    types: Map<string, Type> = new Map();

    constructor(parent?: Scope | null) {
        this.parent = parent ?? null;
    }

    get(name: string): Type {
        let type = this.vars.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.get(name);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`);
        }
    }

    has(name: string): boolean {
        return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
    }

    set(name: string, type: Type): void {
        this.vars.set(name, type);
    }

    getType(name: string): Type {
        let type = this.types.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.getType(name);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`);
        }
    }

    hasType(name: string): boolean {
        return this.types.has(name) || (this.parent ? this.parent.hasType(name) : false);
    }

    setType(name: string, type: Type): void {
        this.types.set(name, type);
    }

    isShadowed(name: string, type: boolean = false): boolean {
        let scope: Scope | null = this;
        let wasFound = false;
        while (scope) {
            let vars = type ? scope.vars : scope.types;
            if (vars.has(name)) {
                if (wasFound) {
                    return true;
                } else {
                    wasFound = true;
                }
            }
            scope = scope.parent;
        }
        return false;
    }

    setLValue(node: b.LVal, const_: boolean, parseType: (type: b.Identifier['typeAnnotation']) => Type, type?: Type): void {
        if (node.type === 'Identifier') {
            type ??= parseType(node.typeAnnotation);
            if (!const_) {
                type = generalizeLiteral(type);
            }
            this.set(node.name, type);
        }
    }

}


export type BaseType<T extends string> = {type: T;}
export type ValueType<T extends string, V> = BaseType<T> & {value: V};
export type ValueTypeFactory<T extends string, V> = BaseType<T> & (<W extends V>(value: W) => ValueType<T, W>);

export type Any = BaseType<'any'>;
export type Unknown = BaseType<'unknown'>;
export type Never = BaseType<'never'>;
export type Undefined = BaseType<'undefined'>;
export type Null = BaseType<'null'>;
export type Void = BaseType<'void'>;
export type BooleanType = ValueTypeFactory<'boolean', boolean>;
export type BooleanLiteral = ReturnType<BooleanType>;
export type NumberType = ValueTypeFactory<'number', number>;
export type NumberLiteral = ReturnType<NumberType>;
export type StringType = ValueTypeFactory<'string', string>;
export type StringLiteral = ReturnType<StringType>;
export type SymbolType = BaseType<'symbol'> & (() => BaseType<'symbol'> & {unique: true}) & {unique: false};
export type UniqueSymbol = ReturnType<SymbolType>;
export type BigIntType = ValueTypeFactory<'bigint', bigint>;
export type BigIntLiteral = ReturnType<BigIntType>;

function addToString<T extends object>(value: T): T {
    return Object.defineProperty(value, 'toString', {value: function(this: Type) {
        return toString(this);
    }, enumerable: false, configurable: true, writable: true});
}

// @ts-ignore
function createType<T extends string, P extends object>(type: T, props: P = {}): BaseType<T> & P {
    return addToString(Object.assign({type}, props));
}

function createValueTypeFactory<T extends string, V>(type: T): ValueTypeFactory<T, V> {
    return addToString(Object.assign(<W extends V>(value: W) => createType(type, {value}), {type}));
}

export const any: Any = createType('any');
export const unknown: Unknown = createType('unknown');
export const never: Never = createType('never');
const undefined_: Undefined = createType('undefined');
const null_: Null = createType('null');
const void_: Void = createType('void');
export {
    undefined_ as undefined,
    null_ as null,
    void_ as void,
};
export const boolean: BooleanType = createValueTypeFactory<'boolean', boolean>('boolean');
export const number: NumberType = createValueTypeFactory<'number', number>('number');
export const string: StringType = createValueTypeFactory<'string', string>('string');
export const symbol: SymbolType = addToString(Object.assign(() => createType('symbol', {unique: true as const}), {type: 'symbol' as const, unique: false as const}));
export const bigint: BigIntType = createValueTypeFactory<'bigint', bigint>('bigint');


export type Parameter = [string, Type];

export interface ObjectCallData {
    params: Parameter[];
    restParam: Parameter | null;
    returnType: Type;
}

interface ObjectType extends BaseType<'object'> {
    props: {[key: PropertyKey]: Type};
    call: ObjectCallData | null;
    construct: ObjectCallData | null;
    indexes: [string, Type, Type][];
};

export type ObjectTypeKeyword = BaseType<'object'> & ((props?: {[key: PropertyKey]: Type}, call?: ObjectCallData | null, indexes?: [string, Type, Type][], construct?: ObjectCallData | null) => ObjectType) & {props: {[key: PropertyKey]: Type}, call: null, indexes: [], construct: null};

// @ts-ignore
export const object: ObjectTypeKeyword = addToString(Object.assign(function(props: {[key: PropertyKey]: Type} = {}, call: ObjectCallData | null = null, indexes: [string, Type, Type][] = [], construct: ObjectCallData | null = null): ObjectType {
    return {type: 'object', props, call, indexes, construct};
}, {type: 'object' as const, props: {} as const, call: null, indexes: [] as const, construct: null}));


interface ArrayType extends ObjectType {
    isArray: true;
    elts: Type | Type[];
}
export type TupleArray = ArrayType & {elts: Type[]};
export type NonTupleArray = ArrayType & {elts: Type};
export function array(elts: Type | Type[]): ArrayType {
    let data: {[key: PropertyKey]: Type} = {length: string};
    let obj: ObjectType;
    if (Array.isArray(elts)) {
        for (let i = 0; i < elts.length; i++) {
            data[i] = elts[i];
        }
        obj = object(data);
    } else {
        obj = object(data, null, [['index', number, elts]]);
    }
    return Object.assign(obj, {elts, isArray: true as const});
}

export function isArray(value: Type): value is ArrayType {
    return value.type === 'object' && 'elts' in value;
}

export function arrayIndex(array: ArrayType, index: number): Type {
    if (Array.isArray(array.elts)) {
        return array.elts[index];
    } else {
        return array.elts;
    }
}


function function_(params: Parameter[], returnType: Type, restParam?: Parameter | null): ObjectType {
    return object({prototype: object({})}, {params, returnType, restParam: restParam ?? null});
}
export {function_ as function};

export function constructor(params: Parameter[], returnType: Type, restParam?: Parameter | null): ObjectType {
    return object({prototype: object({})}, null, [], {params, returnType, restParam: restParam ?? null});
}


export type {
    BooleanType as Boolean,
    NumberType as Number,
    StringType as String,
    SymbolType as Symbol,
    BigIntType as BigInt,
    ObjectType as Object,
    ArrayType as Array,
};


export type Union = BaseType<'union'> & {types: Type[]};
export function union(...types: Type[]): Union {
    return createType('union', {types});
}

export type Intersection = BaseType<'intersection'> & {types: Type[]};
export function intersection(...types: Type[]): Intersection {
    return createType('intersection', {types});
}


export type NonLiteralPrimitive = Undefined | Null | BooleanType | NumberType | StringType | SymbolType | BigIntType;
export type PrimitiveLiteral = BooleanLiteral | NumberLiteral | StringLiteral | UniqueSymbol | BigIntLiteral;
export type Primitive = NonLiteralPrimitive | PrimitiveLiteral;

export type Type = Any | Unknown | Never | Primitive | Void | ObjectType | ObjectTypeKeyword | ArrayType | Union | Intersection;


// https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;

export function matches(a: Any, b: Type): true;
export function matches(a: Type, b: Any): true;
export function matches(a: Type, b: Unknown): true;
export function matches(a: Unknown, b: Unknown): true;
export function matches(a: Unknown, b: Exclude<Type, Unknown>): false;
export function matches(a: Never, b: Type): false;
export function matches(a: Type, b: Never): false;
export function matches(a: Union, b: Type): b is typeof a['types'][number];
export function matches(a: Type, b: Union): a is typeof b['types'][number];
export function matches(a: Intersection, b: Type): b is UnionToIntersection<typeof a['types'][number]>;
export function matches(a: Type, b: Intersection): a is UnionToIntersection<typeof b['types'][number]>;
export function matches(a: Undefined | Void, b: Type): b is Undefined | Void;
export function matches(a: Type, b: Undefined | Void): a is Undefined | Void;
export function matches(a: Null, b: Type): b is Null;
export function matches(a: Type, b: Null): a is Null;
export function matches(a: SymbolType | UniqueSymbol, b: SymbolType): true;
export function matches(a: UniqueSymbol, b: UniqueSymbol): boolean;
export function matches(a: Exclude<Type, UniqueSymbol>, b: UniqueSymbol): false;
export function matches(a: PrimitiveLiteral, b: PrimitiveLiteral): boolean;
export function matches(a: NonLiteralPrimitive, b: NonLiteralPrimitive): a is typeof b;
export function matches(a: ObjectType | ObjectTypeKeyword, b: ObjectTypeKeyword): true;
export function matches(a: Exclude<Type, ObjectType | ObjectTypeKeyword>, b: ObjectTypeKeyword): true;
export function matches(a: ObjectTypeKeyword, b: Exclude<Type, ObjectTypeKeyword>): false;
export function matches(a: ObjectType, b: ObjectType): boolean;
export function matches(a: Type, b: Type): boolean;
export function matches(a: Type, b: Type): boolean {
    if (a.type === 'any' || b.type === 'any' || b.type === 'unknown') {
        return true;
    } else if (a.type === 'unknown' || a.type === 'never' || b.type === 'never') {
        return false;
    } else if (a.type === 'union') {
        return a.types.some(type => matches(type, b));
    } else if (b.type === 'union') {
        return b.types.some(type => matches(a, type));
    } else if (a.type === 'intersection') {
        return a.types.every(type => matches(type, b));
    } else if (b.type === 'intersection') {
        return b.types.every(type => matches(a, type));
    } else if (a.type === 'undefined' || a.type === 'void' || b.type === 'undefined' || b.type === 'void') {
        return (a.type === 'undefined' || a.type === 'void') && (b.type === 'undefined' || b.type === 'void');
    } else if (a.type === 'null' || b.type === 'null') {
        return a.type === 'null' && b.type === 'null';
    } else if (a.type === 'symbol') {
        return (a.unique && a === b) || b.type === 'symbol';
    } else if (b.type === 'symbol') {
        return false;
    } else if (a.type !== b.type) {
        return false;
    } else if (a.type === 'object') {
        if (b.type !== 'object') {
            return false;
        }
        if (!('props' in b)) {
            return true;
        }
        if (!('props' in a)) {
            return false;
        }
        if ('isArray' in a !== 'isArray' in b) {
            return false;
        }
        if ('isArray' in a && 'isArray' in b) {
            if (Array.isArray(a.elts)) {
                if (Array.isArray(b.elts)) {
                    if (a.elts.length < b.elts.length) {
                        return false;
                    }
                    for (let i = 0; i < a.elts.length; i++) {
                        if (!matches(a.elts[i], b.elts[i])) {
                            return false;
                        }
                    }
                    return true;
                }
            } else if (Array.isArray(b.elts)) {
                return false;
            } else {
                return matches(a.elts, b.elts);
            }
        }
        if (b.call) {
            if (!a.call) {
                return false;
            }
            if (!matches(a.call.returnType, b.call.returnType)) {
                return false;
            }
            if (b.call.restParam && (!a.call.restParam || !matches(a.call.restParam[1], b.call.restParam[1]))) {
                return false;
            }
            if (a.call.params.length < b.call.params.length) {
                return false;
            }
            for (let i = 0; i < b.call.params.length; i++) {
                if (!matches(a.call.params[i][1], b.call.params[i][1])) {
                    return false;
                }
            }
        }
        for (let key of Reflect.ownKeys(a.props)) {
            if (!(key in a.props)) {
                return false;
            }
        }
        return true;
    } else if ('value' in b) {
        return 'value' in a && a.value === b.value;
    } else {
        return true;
    }
}


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

export function toString(type: Type, colors: boolean | HighlightColors = false): string {
    if (colors) {
        return highlight(toString(type), colors === true ? undefined : colors);
    }
    if (['any', 'unknown', 'never', 'undefined', 'null', 'void'].includes(type.type)) {
        return type.type;
    } else if (type.type === 'union') {
        return type.types.map(type => toString(type)).join(' | ');
    } else if (type.type === 'intersection') {
        return type.types.map(type => toString(type)).join(' & ');
    } else if (!('value' in type || 'props' in type)) {
        if ('unique' in type && type.unique) {
            return 'unique symbol';
        }
        return type.type;
    } else if (type.type === 'object') {
        if ('isArray' in type) {
            if (Array.isArray(type.elts)) {
                return '[' + type.elts.map(x => toString(x)).join(', ') + ']';
            } else {
                return toString(type.elts) + '[]';
            }
        }
        let params: string | null = null;
        if (type.call) {
            params = '(';
            for (let [name, paramType] of type.call.params) {
                params += name + ': ' + toString(paramType) + ', ';
            }
            if (type.call.restParam) {
                params += '...' + type.call.restParam[0] + ': ' + toString(type.call.restParam[1]);
            } else if (type.call.params.length > 0) {
                params = params.slice(0, -2);
            }
            params += ')';
        }
        if (Object.keys(type.props).length === 0) {
            if (type.call) {
                return params + ' => ' + toString(type.call.returnType);
            } else {
                return '{}';
            }
        }
        let out = '{\n';
        for (let key in type.props) {
            if (typeof key === 'symbol') {
                continue;
            }
            out += '    ' + key + ': ' + toString(type.props[key]) + '\n';
        }
        if (type.call) {
            out += '    ' + params + ': ' + toString(type.call.returnType) + ';\n';
        }
        out += '}';
        return out;
    } else if (type.type === 'boolean' || type.type === 'number') {
        return type.value.toString();
    } else if (type.type === 'string') {
        let out = '';
        for (let char of type.value) {
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
    } else if (type.type === 'bigint') {
        return type.value + 'n';
    } else {
        throw new Error('invalid type');
    }
}


export function resolveObjectIntersection(...objects: ObjectType[]): ObjectType {
    let out = object({});
    for (let obj of objects) {
        for (let key of Reflect.ownKeys(obj.props)) {
            out.props[key] = obj.props[key];
        }
        if (obj.call) {
            out.call = obj.call;
        }
        for (let index of obj.indexes) {
            out.indexes.push(index);
        }
    }
    return out;
}

export function generalizeLiteral(type: Type): Type {
    if ('value' in type) {
        if (type.type === 'boolean') {
            return boolean;
        } else if (type.type === 'number') {
            return number;
        } else if (type.type === 'string') {
            return string;
        } else {
            return bigint;
        }
    } else if (type.type === 'object' && 'isArray' in type) {
        if (type.elts instanceof Array) {
            return array(union(...type.elts));
        } else {
            return type;
        }
    } else {
        return type;
    }
}

export function isTruthy(type: Type): boolean | 'maybe' {
    if ('value' in type) {
        return Boolean(type.value);
    }
    switch (type.type) {
        case 'undefined':
        case 'null':
        case 'void':
            return false;
        case 'symbol':
        case 'object':
        case 'intersection':
            return true;
        case 'union':
            let out: boolean | 'maybe' = 'maybe';
            for (let x of type.types) {
                let y = isTruthy(x);
                out = out === 'maybe' || y === 'maybe' ? 'maybe' : out || y;
            }
            return out;
        default:
            return 'maybe';
    }
}

export function isNullish(type: Type): boolean | 'maybe' {
    switch (type.type) {
        case 'undefined':
        case 'null':
        case 'void':
            return true;
        case 'boolean':
        case 'number':
        case 'string':
        case 'symbol':
        case 'bigint':
        case 'object':
        case 'intersection':
            return false;
        case 'union':
            let out: boolean | 'maybe' = 'maybe';
            for (let x of type.types) {
                let y = isNullish(x);
                out = out === 'maybe' || y === 'maybe' ? 'maybe' : out || y;
            }
            return out;
        default:
            return 'maybe';
    }
}
