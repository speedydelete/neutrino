
import {Expression} from '@babel/types';


interface BaseType<T extends string = string> {
    type: T;
    toString(): string;
    isCompatible(other: Type): boolean;
    copy(): BaseType<T>;
    with(vars: {[key: string]: Type}): Type;
}

export type Any = BaseType<'any'>;
export type Unknown = BaseType<'unknown'>;
export type Never = BaseType<'never'>;
export type Undefined = BaseType<'undefined'>;
export type Void = BaseType<'void'>;
export type Null = BaseType<'null'>;

export type BooleanKeyword = BaseType<'boolean'>;
export type NumberKeyword = BaseType<'number'>;
export type StringKeyword = BaseType<'string'>;
export type SymbolKeyword = BaseType<'symbol'>;
export type BigIntKeyword = BaseType<'bigint'>;

interface ValueType<T extends string = string, Value extends any = any> extends BaseType<T> {
    copy(): ValueType<T, Value>;
    value: Value;
}

export type BooleanValue = ValueType<'boolean_value', boolean>;
export type NumberValue = ValueType<'number_value', number>;
export type StringValue = ValueType<'string_value', string>;
export type BigIntValue = ValueType<'bigint_value', bigint>;

export interface UniqueSymbol extends BaseType<'unique_symbol'> {
    copy(): UniqueSymbol;
    id: number;
}

export type Boolean = BooleanKeyword | BooleanValue;
export type Number = NumberKeyword | NumberValue;
export type String = StringKeyword | StringValue;
export type Symbol = SymbolKeyword | UniqueSymbol;
export type BigInt = BigIntKeyword | BigIntValue;

export type PrimitiveValue = BooleanValue | NumberValue | StringValue | BigIntValue;
export type PrimitiveKeyword = BooleanKeyword | NumberKeyword | StringKeyword | BigIntKeyword;

export type Parameter = [string, Type] | [string, Type, Expression | undefined];
export type RestParameter = [string, Type];
export interface CallData {
    params: Parameter[];
    restParam?: RestParameter;
    typeParams?: TypeParameter[];
    returnType: Type;
    noThis?: boolean;
    cName?: string;
    thisIsAnyArray?: boolean;
    realVoid?: boolean;
}

export interface IndexSignature {
    name: string;
    key: Type;
    value: Type;
}

export type SpecialName = 'function' | 'array' | 'proxy' | 'arraybuffer' | 'int8array' | 'uint8array' | 'uint8clampedarray' | 'int16array' | 'uint16array' | 'int32array' | 'uint32array' | 'bigint64array' | 'biguint64array' | 'float32array' | 'float64array' | 'date' | 'regexp' | 'set' | 'map' | 'symbolFunction';

interface ObjectType extends BaseType<'object'> {
    copy(): ObjectType;
    props: {[key: PropertyKey]: Type};
    indexes: IndexSignature[];
    call?: CallData;
    construct?: CallData;
    specialName?: SpecialName;
}

export interface Union<T extends NonUnionType = NonUnionType> extends BaseType<'union'> {
    copy(): Union<T>;
    types: T[];
}

export interface Intersection extends BaseType<'intersection'> {
    copy(): Intersection;
    types: Type[];
}

export interface TypeVar extends BaseType<'typevar'> {
    copy(): TypeVar;
    name: string;
}

export interface TypeParameter {
    name: string;
    constraint?: Type;
    default?: Type;
}

export interface Generic extends BaseType<'generic'> {
    copy(): Generic;
    value: Type;
    params: TypeParameter[];
}

export interface Infer extends BaseType<'infer'> {
    copy(): Infer;
    name: string;
}

export interface Conditional extends BaseType<'conditional'> {
    copy(): Conditional;
    test: Type;
    constraint: Type;
    true: Type;
    false: Type;
}

export type NonUnionType = Any | Unknown | Never | Undefined | Void | Null | Boolean | Number | String | Symbol | BigInt | ObjectType | Intersection | Generic | TypeVar | Infer | Conditional;
export type Type = NonUnionType | Union;


function createType<T extends Type>(type: T['type'], toString?: T['toString'] | null, isCompatible?: T['isCompatible'] | null, copy?: T['copy'] | null, withFunc?: T['with'] | null): T {
    return {
        type,
        toString: toString ?? (() => type),
        isCompatible: isCompatible ?? function(other) {
            return other.type === type;
        },
        copy: copy ?? function(this: T) {
            return this;
        },
        with: withFunc ?? function(this: T, vars: {[key: string]: Type}) {
            return this;
        },
    } as T;
}

export const any = createType<Any>('any', null, () => true);
export const unknown = createType<Unknown>('unknown');
export const never = createType<Never>('never');

const undefined_ = createType<Undefined>('undefined', null, other => other.type === 'undefined' || other.type === 'void');
const void_ = createType<Void>('void', null, other => other.type === 'void' || other.type === 'undefined');
const null_ = createType<Null>('null');

function createValueTypeFactory<T extends PrimitiveValue, F extends PrimitiveKeyword>(factoryType: F['type'], valueType: T['type'], toString?: (this: T) => string): F & ((value: T['value']) => T) {
    let valueProto = createType(valueType, toString ?? function(this: T) {
        return String(this.value);
    }, function(this: T, other: Type) {
        return other.type === valueType && 'value' in other && this.value === other.value;
    });
    return Object.assign(
        (value: T['value']) => Object.assign(Object.create(valueProto), {value}),
        createType(factoryType, null, other => other.type === factoryType || other.type === valueType),
    );
}

export const boolean: BooleanKeyword & ((value: boolean) => BooleanValue) = createValueTypeFactory('boolean', 'boolean_value');
export const number: NumberKeyword & ((value: number) => NumberValue) = createValueTypeFactory('number', 'number_value');
export const string: StringKeyword & ((value: string) => StringValue) = createValueTypeFactory('string', 'string_value');
export const bigint: BigIntKeyword & ((value: bigint) => BigIntValue) = createValueTypeFactory('bigint', 'bigint_value');

let nextSymbolID = 1;
let symbolProto = createType('unique_symbol', () => 'unique symbol', function(this: UniqueSymbol, other: Type) {
    return other.type === 'unique_symbol' && other.id === this.id;
});
export const symbol: SymbolKeyword & (() => UniqueSymbol) = Object.assign(function() {
    return Object.assign(Object.create(symbolProto), {id: nextSymbolID++});
}, createType<SymbolKeyword>('symbol', null, other => other.type === 'symbol' || other.type === 'unique_symbol'));


type TypeFactory<T, P extends any[]> = (...args: P) => T;

function createTypeFactory<T extends Type, P extends any[]>(type: T['type'], func: (...args: P) => any, toString?: T['toString'] | null, isCompatible?: T['isCompatible'] | null, copy?: T['copy'] | null, withFunc?: T['with'] | null): TypeFactory<T, P> {
    let proto = createType(type, toString, isCompatible, copy, withFunc);
    return function(...args: P): T {
        return Object.assign(Object.create(proto), func(...args));
    }
}


function callDataToString(call: CallData, arrow?: boolean): string {
    let params = call.params.map(x => x[0] + ': ' + x[1]).join(', ');
    if (call.restParam) {
        params += '...' + call.restParam[0] + ': ' + call.restParam[1];
    }
    if (arrow) {
        return `(${params}) => ${call.returnType}`;
    } else {
        return `(${params}): ${call.returnType}`;
    }
}


const _object: TypeFactory<ObjectType, [props?: {[key: PropertyKey]: Type}, indexes?: IndexSignature[], call?: CallData, construct?: CallData, specialName?: string]> = createTypeFactory('object', function(props: {[key: PropertyKey]: Type} = {}, indexes: IndexSignature[] = [], call?: CallData, construct?: CallData, specialName?: string) {
    return {props, indexes, call, construct, specialName};
}, function(this: ObjectType): string {
    let keys = Reflect.ownKeys(this.props);
    if (this.call && this.specialName === 'function') {
        return callDataToString(this.call, true);
    }
    let out: string[] = [];
    for (let key of keys) {
        out.push(String(key) + ': ' + this.props[key]);
    }
    for (let index of this.indexes) {
        out.push(`[${index.name}: ${index.key}]: ${index.value}`);
    }
    if (this.call) {
        out.push(callDataToString(this.call));
    }
    if (this.construct) {
        out.push(callDataToString(this.construct));
    }
    return '{' + out.join(', ') + '}';
}, function(this: ObjectType, other: Type): boolean {
    if (other.type !== 'object') {
        return false;
    }
    for (let key of Reflect.ownKeys(this.props)) {
        let prop = other.props[key];
        if (!prop || !this.props[key].isCompatible(other.props[key])) {
            return false;
        }
    }
    if (this.call) {
        if (!other.call) {
            return false;
        }
        if (!other.call.returnType.isCompatible(this.call.returnType)) {
            return false;
        }
        if (this.call.restParam) {
            if (!other.call.restParam || !other.call.restParam[1].isCompatible(this.call.restParam[1])) {
                return false;
            }
        }
        for (let i = 0; i < this.call.params.length; i++) {
            let param = other.call.params[i];
            if (!param || !this.call.params[i][1].isCompatible(param[1])) {
                return false;
            }
        }
    }
    for (let index of this.indexes) {
        let found = false;
        for (let otherIndex of other.indexes) {
            if (index.key.isCompatible(otherIndex.key) && index.value.isCompatible(otherIndex.value)) {
                found = true;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}, function(this: ObjectType) {
    let props: {[key: PropertyKey]: Type} = {};
    for (let key of Reflect.ownKeys(this.props)) {
        props[key] = this.props[key].copy();
    }
    let call: CallData | undefined = undefined;
    if (this.call) {
        call = {
            params: this.call.params.map(param => [param[0], param[1].copy(), param[2]]),
            restParam: this.call.restParam ? [this.call.restParam[0], this.call.restParam[1].copy()] : undefined,
            returnType: this.call.returnType.copy(),
        };
    }
    let indexes: IndexSignature[] = [];
    for (let index of this.indexes) {
        indexes.push({name: index.name, key: index.key.copy(), value: index.value.copy()});
    }
    return object(props, indexes, call);
}, function(this: ObjectType, vars: {[key: string]: Type}) {
    let out = object();
    for (let key of Reflect.ownKeys(this.props)) {
        out.props[key] = this.props[key].with(vars);
    }
    if (this.call) {
        out.call = {
            params: this.call.params.map(param => [param[0], param[1].with(vars), param[2]]),
            restParam: this.call.restParam ? [this.call.restParam[0], this.call.restParam[1].with(vars)] : undefined,
            returnType: this.call.returnType.with(vars),
        }
    }
    for (let index of this.indexes) {
        out.indexes.push({
            name: index.name,
            key: index.key.with(vars),
            value: index.value.with(vars),
        })
    }
    return out;
});
export const object: typeof _object & ObjectType = Object.assign(_object, _object());

export function specialObject(specialName: string, props?: {[key: PropertyKey]: Type}, indexes?: IndexSignature[], call?: CallData, construct?: CallData): ObjectType {
    return object(props, indexes, call, construct, specialName);
}

function function_(params: Parameter[], returnType: Type, restParam?: RestParameter): ObjectType {
    return specialObject('function', {}, [], {params,returnType, restParam});
}

export function array(elts: Type | Type[]): ObjectType {
    if (Array.isArray(elts)) {
        return specialObject('array', Object.fromEntries(elts.map((x, i) => [x, i])));
    } else {
        return specialObject('array', {}, [{name: 'index', key: number, value: elts}]);
    }
}


export const union: <T extends Type>(...args: (T | T[])[]) => Union<Exclude<T, Union>> = createTypeFactory('union', function(...types: (Type | Type[])[]) {
    return {types: types.flat().map(type => type.type === 'union' ? type.types : type).flat()};
}, function(this: Union) {
    return this.types.join(' | ');
}, function(this: Union, other: Type) {
    return this.types.some(type => type.isCompatible(other));
}, function<T extends NonUnionType>(this: Union<T>): Union<T> {
    // @ts-ignore
    return union(this.types.map(type => type.copy()));
}, function(this: Union, vars: {[key: string]: Type}) {
    return union(this.types.map(type => type.with(vars)));
});

export const intersection: TypeFactory<Intersection, (Type | Type[])[]> = createTypeFactory('intersection', function(...types: (Type | Type[])[]) {
    return {types: types.flat().map(type => type.type === 'intersection' ? type.types : type).flat()};
}, function(this: Intersection) {
    return this.types.join(' & ');
}, function(this: Intersection, other: Type) {
    return this.types.some(type => type.isCompatible(other));
}, function(this: Intersection) {
    return intersection(this.types.map(type => type.copy()));
}, function(this: Intersection, vars: {[key: string]: Type}) {
    return intersection(this.types.map(type => type.with(vars)));
});

export const typevar: TypeFactory<TypeVar, [name: string]> = createTypeFactory('typevar', function(name: string) {
    return {name};
}, function(this: TypeVar) {
    return this.name;
}, function(this: TypeVar, other: Type) {
    return other.type === 'typevar' && this.name === other.name;
}, function(this: TypeVar) {
    return typevar(this.name);
}, function(this: TypeVar, vars: {[key: string]: Type}) {
    if (this.name in vars) {
        return vars[this.name];
    } else {
        return this;
    }
});

export const generic: TypeFactory<Generic, [value: Type, args: TypeParameter[]]> = createTypeFactory('generic', function(value: Type, args: TypeParameter[]) {
    return {value, args};
}, function(this: Generic) {
    return '<' + this.params.map(param => {
        let out = param.name;
        if (param.constraint) {
            out += ' extends ' + param.constraint;
        }
        if (param.default) {
            out += ' = ' + param.default;
        }
        return out;
    }).join(', ') + '>(' + this.value + ')';
});

export const infer: TypeFactory<Infer, [name: string]> = createTypeFactory('infer', function(name: string) {
    return {name};
}, function(this: Infer) {
    return this.name;
}, function(this: Infer, other: Type) {
    return other.type === 'infer' && this.name === other.name;
}, function(this: Infer) {
    return infer(this.name);
}, function(this: Infer) {
    return this;
});

let conditionalProto = createType('conditional', function(this: Conditional) {
    return this.test + ' extends ' + this.constraint + ' ? ' + this.true + ' : ' + this.false;
}, function(this: Conditional, other: Type) {
    return this.true.isCompatible(other) && this.false.isCompatible(other);
}, function(this: Conditional) {
    return conditional(this.test, this.constraint, this.true, this.false) as Conditional;
}, function(this: Conditional, vars: {[key: string]: Type}) {
    return conditional(this.test.with(vars), this.constraint.with(vars), this.true.with(vars), this.false.with(vars));
});

export function extractInfers(test: Type, constraint: Type): {[key: string]: Type} {
    let out: {[key: string]: Type} = {};
    if (test.type === 'object' && constraint.type === 'object') {
        for (let key of Reflect.ownKeys(test.props)) {
            Object.assign(out, extractInfers(test.props[key], constraint.props[key]));
        }
        if (test.call || test.construct) {
            let calls: [CallData, CallData][] = [];
            if (test.call && constraint.call) {
                calls.push([test.call, constraint.call]);
            }
            if (test.construct && constraint.construct) {
                calls.push([test.construct, constraint.construct]);
            }
            for (let [a, b] of calls) {
                for (let i = 0; i < a.params.length; i++) {
                    Object.assign(out, extractInfers(a.params[i][1], b.params[i][1]));
                }
                if (a.restParam && b.restParam) {
                    Object.assign(out, extractInfers(a.restParam[1], b.restParam[1]));
                }
                Object.assign(out, extractInfers(a.returnType, b.returnType));
            }
        }
    } else if (constraint.type === 'union' || constraint.type === 'intersection') {
        for (let type of constraint.types) {
            if (constraint.isCompatible(test)) {
                Object.assign(type, extractInfers(test, type));
            }
        }
    } else if (test.type === 'intersection') {
        test = simplifyIntersection(test);
        if (test.type === 'intersection') {
            for (let type of test.types) {
                Object.assign(out, extractInfers(type, constraint));
            }
        } else {
            Object.assign(out, extractInfers(test, constraint));
        }
    } else if (constraint.type === 'generic') {
        Object.assign(out, extractInfers(test, constraint.value));
    } else if (constraint.type === 'infer') {
        out[constraint.name] = test;
    }
    return out;
}

export function conditional(test: Type, constraint: Type, trueType: Type, falseType: Type): Type {
    if (test.type === 'union') {
        return union(test.types.map(type => conditional(type, constraint, trueType, falseType)));
    } else if (traverse(test, type => type.type === 'typevar').some(x => x)) {
        return Object.assign(Object.create(conditionalProto), {test, constraint, true: trueType, false: falseType});
    } else if (constraint.isCompatible(test)) {
        return trueType.with(extractInfers(test, constraint));
    } else {
        return falseType;
    }
}


export function traverse<T>(type: Type, func: (type: Type) => T): T[] {
    let out = [func(type)];
    if (type.type === 'object') {
        out.push(...Reflect.ownKeys(type.props).flatMap(key => traverse(type.props[key], func)));
        out.push(...type.indexes.flatMap(index => traverse(index.key, func).concat(traverse(index.value, func))));
        if (type.call || type.construct) {
            let calls: CallData[] = [];
            if (type.call) {
                calls.push(type.call);
            }
            if (type.construct) {
                calls.push(type.construct);
            }
            for (let call of calls) {
                out.push(...call.params.flatMap(param => traverse(param[1], func)));
                if (call.restParam) {
                    out.push(...traverse(call.restParam[1], func));
                }
                out.push(...traverse(call.returnType, func));
            }
        }
    } else if (type.type === 'union' || type.type === 'intersection') {
        out.push(...type.types.flatMap(type => traverse(type, func)));
    } else if (type.type === 'generic') {
        out.push(...traverse(type.value, func));
    } else if (type.type === 'conditional') {
        out.push(...traverse(type.test, func), ...traverse(type.constraint, func), ...traverse(type.true, func), ...traverse(type.false, func));
    }
    return out;
}

export function objectAssign(target: ObjectType, ...types: ObjectType[]): ObjectType {
    for (let type of types) {
        for (let key of Reflect.ownKeys(type.props)) {
            if (key in target.props) {
                target.props[key] = union(target.props[key], type.props[key].copy());
            } else {
                target.props[key] = type.props[key].copy();
            }
        }
        target.indexes.push(...type.indexes);
    }
    return target;
}

export function simplifyIntersection(type: Intersection): Type {
    let obj = object();
    let rest: Type[] = [];
    for (let subtype of type.types) {
        if (subtype.type === 'object') {
            objectAssign(obj, subtype);
        } else {
            rest.push(subtype);
        }
    }
    if (rest.length > 0) {
        return intersection(obj, rest);
    } else {
        return obj;
    }
}

export function isNullish(type: Type): boolean | 'maybe' {
    return type.type === 'any' ? 'maybe' : type.type === 'undefined' || type.type === 'null';
}

export function isTruthy(type: Type): boolean | 'maybe' {
    return (type.type === 'boolean' || type.type === 'number' || type.type === 'string') ? 'maybe' : !(type.type === 'undefined' || type.type === 'null');
}

export function getArrayElts(type: ObjectType): Type | Type[] {
    for (let index of type.indexes) {
        if (index.key === number) {
            return index.value;
        }
    }
    let out: Type[] = [];
    for (let i = 0; i in type.props; i++) {
        out.push(type.props[i]);
    }
    return out;
}


export type NonUnionSimpleType = Any | Undefined | Null | Boolean | Number | String | Symbol | BigInt | ObjectType;
export type SimpleUnion = Union<NonUnionSimpleType>;
export type SimpleType = NonUnionSimpleType | SimpleUnion;


export {
    undefined_ as undefined,
    void_ as void,
    null_ as null,
    function_ as function,
    ObjectType as Object,
};
