
import {Expression} from '@babel/types';


interface ToString {
    toString(): string;
}


interface AnyType extends ToString {
    type: 'any';
}

interface UndefinedType extends ToString {
    type: 'undefined';
}

interface NullType extends ToString {
    type: 'null';
}

interface BooleanType extends ToString {
    type: 'boolean';
}

interface NumberType extends ToString {
    type: 'number';
}

interface StringType extends ToString {
    type: 'string';
}

interface SymbolType extends ToString {
    type: 'symbol';
}

export type Parameter = [string, Type, Expression | null];
export type RestParameter = [string, Type];

export interface CallData {
    params: Parameter[];
    restParam?: RestParameter;
    returnType: Type;
    noThis?: boolean;
    cName?: string;
    thisIsAnyArray?: boolean;
}

export interface Indexes {
    string?: Type;
    number?: Type;
    symbol?: Type;
}

interface ObjectType extends ToString {
    type: 'object';
    props: {[key: PropertyKey]: Type};
    call: CallData | null;
    indexes: Indexes;
}

interface ArrayType extends ToString {
    type: 'array';
    elts: Type | Type[];
}

export type Type = AnyType | UndefinedType | NullType | BooleanType | NumberType | StringType | SymbolType | ObjectType | ArrayType;

export const any: AnyType = {type: 'any', toString() {return 'any'}};
const undefined_: UndefinedType = {type: 'undefined', toString() {return 'undefined';}};
const null_: NullType = {type: 'null', toString() {return 'null';}};
export const boolean: BooleanType = {type: 'boolean', toString() {return 'boolean';}};
export const number: NumberType = {type: 'number', toString() {return 'number';}};
export const string: StringType = {type: 'string', toString() {return 'string';}};
export const symbol: SymbolType = {type: 'symbol', toString() {return 'symbol';}};

export const INDEXES = ['string', 'number', 'symbol'] as const;

export function object(props: {[key: PropertyKey]: Type} = {}, call: CallData | null = null, indexes: Indexes = {}): ObjectType {
    return {type: 'object', props, call, indexes, toString() {return 'object';}};
}
export function array(elts: Type | Type[]): ArrayType {
    return {type: 'array', elts, toString() {return 'array';}};
}

function function_(params: Parameter[], returnType: Type, restParam?: RestParameter): ObjectType & {call: CallData} {
    return object({prototype: object()}, {params, returnType, restParam}) as ObjectType & {call: CallData};
}

export {
    AnyType as Any,
    UndefinedType as Undefined,
    NullType as Null,
    BooleanType as Boolean,
    NumberType as Number,
    StringType as String,
    SymbolType as Symbol,
    ObjectType as Object,
    undefined_ as undefined,
    null_ as null,
    function_ as function,
};


export function copy<T extends Type>(type: T): T {
    switch (type.type) {
        case 'object':
            let props: {[key: PropertyKey]: Type} = {};
            for (let key of Reflect.ownKeys(type.props)) {
                props[key] = copy(type.props[key]);
            }
            let call: CallData | null = null;
            if (type.call) {
                call = {
                    params: type.call.params.map(param => [param[0], copy(param[1]), param[2]]),
                    restParam: type.call.restParam ? [type.call.restParam[0], copy(type.call.restParam[1])] : undefined,
                    returnType: copy(type.call.returnType),
                };
            }
            let indexes: Indexes = {};
            if (type.indexes.string) {
                indexes.string = copy(type.indexes.string);
            }
            if (type.indexes.number) {
                indexes.number = copy(type.indexes.number);
            }
            if (type.indexes.symbol) {
                indexes.symbol = copy(type.indexes.symbol);
            }
            // @ts-ignore
            return object(props, call, indexes);
        case 'array':
            // @ts-ignore
            return array(Array.isArray(type.elts) ? type.elts.map(copy) : copy(type.elts));
        default:
            return type;
    }
}

export function union(...types: (Type | Type[])[]): Type {
    let actualTypes = types.flat();
    let firstType = actualTypes[0];
    if (actualTypes.every(x => x.type === firstType.type)) {
        return copy(firstType);
    } else {
        return any;
    }
}

export function objectAssign(out: ObjectType, ...types: ObjectType[]): ObjectType {
    for (let type of types.slice(1)) {
        for (let key of Reflect.ownKeys(type.props)) {
            if (key in out.props) {
                out.props[key] = union(out.props[key], type.props[key]);
            } else {
                out.props[key] = type.props[key];
            }
        }
        for (let key of INDEXES) {
            if (type.indexes[key]) {
                if (out.indexes[key]) {
                    out.indexes[key] = union(out.indexes[key], type.indexes[key]);
                } else {
                    out.indexes[key] = type.indexes[key];
                }
            }
        }
        if (out.call) {
            if (type.call) {
                for (let i = 0; i < out.call.params.length; i++) {
                    if (type.call.params[i]) {
                        out.call.params[i][1] = union(out.call.params[i][1], type.call.params[i][1]);
                    }
                }
                if (out.call.restParam) {
                    if (type.call.restParam) {
                        out.call.restParam[1] = union(out.call.restParam[1], type.call.restParam[1]);
                    }
                } else {
                    out.call.restParam = undefined;
                }
                out.call.returnType = union(type.call.returnType, out.call.returnType);
            } else {
                out.call = null;
            }
        }
    }
    return out;
}

export function mergeObjects(types: ObjectType[]): ObjectType {
    return objectAssign(object(), ...types);
}

export function intersection(...types: (Type | Type[])[]): Type {
    let actualTypes = types.flat();
    let firstType = actualTypes[0];
    if (actualTypes.every(x => x.type === firstType.type)) {
        if (firstType.type === 'object') {
            return mergeObjects(actualTypes as ObjectType[]);
        } else if (firstType.type === 'array') {
            return any;
        } else {
            return firstType;
        }
    } else {
        return any;
    }
}

export function isNullish(type: Type): boolean | 'maybe' {
    return type.type === 'any' ? 'maybe' : type.type === 'undefined' || type.type === 'null';
}

export function isTruthy(type: Type): boolean | 'maybe' {
    return (type.type === 'boolean' || type.type === 'number' || type.type === 'string') ? 'maybe' : !(type.type === 'undefined' || type.type === 'null');
}

function extends_(a: Type, b: Type): boolean {
    if (a.type === 'object' && b.type === 'object') {
        for (let key of Reflect.ownKeys(b.props)) {
            let prop = a.props[key];
            if (!prop || !extends_(prop, b.props[key])) {
                return false;
            }
        }
        if (b.call) {
            let aCall = a.call;
            let bCall = b.call;
            if (!aCall) {
                return false;
            }
            if (!extends_(aCall.returnType, bCall.returnType)) {
                return false;
            }
            if (bCall.restParam) {
                if (!aCall.restParam) {
                    return false;
                }
                if (!extends_(bCall.restParam[1], aCall.restParam[1])) {
                    return false;
                }
            }
            if (!bCall.params.every((x, i) => aCall.params[i] && extends_(aCall.params[i][1], bCall.params[i][1]))) {
                return false;
            }
        }
        for (let key of INDEXES) {
            if (b.indexes[key]) {
                if (!a.indexes[key]) {
                    return false;
                }
                if (!extends_(a.indexes[key], b.indexes[key])) {
                    return false;
                }
            }
        }
        return true;
    } else if (a.type === 'array' && b.type === 'array') {
        let aElts = a.elts;
        let bElts = b.elts;
        if (Array.isArray(bElts)) {
            if (Array.isArray(aElts)) {
                return bElts.every((x, i) => aElts[i] && extends_(aElts[i], x));
            } else {
                return false;
            }
        } else {
            if (Array.isArray(aElts)) {
                return aElts.every(x => extends_(x, bElts));
            } else {
                return extends_(aElts, bElts);
            }
        }
    } else if (a.type === 'any' || b.type === 'any') {
        return true;
    } else {
        return a.type === b.type;
    }
}

export {extends_ as extends};
