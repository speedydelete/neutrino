
interface BaseType<T extends string = string> {
    type: T;
    toString(): string;
    isCompatible(other: Type): boolean;
    copy(): this;
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
    value: Value;
}

export type BooleanValue = ValueType<'boolean-value', boolean>;
export type NumberValue = ValueType<'number-value', number>;
export type StringValue = ValueType<'string-value', string>;
export type BigIntValue = ValueType<'bigint-value', bigint>;

export type UniqueSymbol = BaseType<'unique-symbol'> & {id: number};

export type Boolean = BooleanKeyword | BooleanValue;
export type Number = NumberKeyword | NumberValue;
export type String = StringKeyword | StringValue;
export type Symbol = SymbolKeyword | UniqueSymbol;
export type BigInt = BigIntKeyword | BigIntValue;

export type Parameter = [string, Type];
export interface CallData {
    params: Parameter[];
    restParam?: Parameter;
    returnType: Type;
}

export interface IndexSignature {
    name: string;
    key: Type;
    value: Type;
}

interface ObjectType extends BaseType<'object'> {
    props: {[key: PropertyKey]: Type};
    indexes: IndexSignature[];
    call?: CallData;
}
export {ObjectType as Object};

export interface Union extends BaseType<'union'> {
    types: Type[];
}

export interface Intersection extends BaseType<'intersection'> {
    types: Type[];
}

export interface TypeVar extends BaseType<'type-var'> {
    name: string;
}

export interface Infer extends BaseType<'infer'> {
    name: string;
}

export interface Conditional extends BaseType<'conditional'> {
    test: Type;
    constraint: Type;
    true: Type;
    false: Type;
}

export interface TemplateValue extends BaseType<'template-value'> {
    parts: (Type | string)[];
}

export interface MappedType extends BaseType<'mapped'> {
    name: string;
    keyOf: Type;
    remapped?: Type;
    value: Type;
}

export type Type = Any | Unknown | Never | Undefined | Void | Null | Boolean | Number | String | Symbol | ObjectType | Union | Intersection | TypeVar | Infer | Conditional | TemplateValue | MappedType;


function createType<T extends BaseType>(type: T['type'], toString?: T['toString'] | null, isCompatible?: T['isCompatible'] | null, copy?: T['copy'] | null, withFunc?: T['with'] | null): T {
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

export const any = createType('any', null, () => true);
export const unknown = createType('unknown');
export const never = createType('never');

const undefined_ = createType('undefined', null, other => other.type === 'undefined' || other.type === 'void');
const void_ = createType('void', null, other => other.type === 'void' || other.type === 'undefined');
const null_ = createType('null');

function createValueTypeFactory<T extends ValueType, F extends BaseType>(factoryType: F['type'], valueType: T['type'], toString?: (this: T) => string): F & ((value: T['value']) => T) {
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

export const boolean: BooleanKeyword & ((value: boolean) => BooleanValue) = createValueTypeFactory('boolean', 'boolean-value');
export const number: NumberKeyword & ((value: number) => NumberValue) = createValueTypeFactory('number', 'number-value');
export const string: StringKeyword & ((value: string) => StringValue) = createValueTypeFactory('string', 'string-value');
export const bigint: BigIntKeyword & ((value: bigint) => BigIntValue) = createValueTypeFactory('bigint', 'bigint-value');

let nextSymbolID = 1;
let symbolProto = createType('unique-symbol', () => 'unique symbol', function(this: UniqueSymbol, other: Type) {
    return other.type === 'unique-symbol' && other.id === this.id;
});
export const symbol: SymbolKeyword & (() => UniqueSymbol) = Object.assign(function() {
    return Object.assign(Object.create(symbolProto), {id: nextSymbolID++});
}, createType<SymbolKeyword>('symbol', null, other => other.type === 'symbol' || other.type === 'unique-symbol'));


let objectProto = createType<ObjectType>('object', function(this: ObjectType): string {
}, function(this: ObjectType, other: Type): boolean {
    if (other.type !== 'object') {
        return false;
    }
    for (let key of Reflect.ownKeys(this.props)) {
        let prop = this.props[key];
        if (!prop || !prop.isCompatible(other.props[key])) {
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
            params: this.call.params.map(param => [param[0], param[1].copy()]),
            restParam: this.call.restParam ? [this.call.restParam[0], this.call.restParam[1].copy()] : undefined,
            returnType: this.call.returnType.copy(),
        };
    }
    let indexes: IndexSignature[] = [];
    for (let index of this.indexes) {

    }
    return object(props, indexes, call);
}, function(this: ObjectType, vars: {[key: string]: Type}) {
    let out = object();
    for (let key of Reflect.ownKeys(this.props)) {
        out.props[key] = this.props[key].with(vars);
    }
    if (this.call) {
        out.call = {
            params: this.call.params.map(param => [param[0], param[1].with(vars)]),
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
export const object: Object & ((props?: {[key: PropertyKey]: Type}, indexes?: IndexSignature[], call?: CallData) => ObjectType) = Object.assign(function(props: {[key: PropertyKey]: Type} = {}, indexes: IndexSignature[] = [], call?: CallData) {
    return Object.assign(Object.create(objectProto), {props, indexes, call});
}, objectProto, {props: {}, indexes: {}});


export {
    undefined_ as undefined,
    void_ as void,
    null_ as null,
};


export function isNullish(type: Type): boolean | 'maybe' {
    return type.type === 'any' ? 'maybe' : type.type === 'undefined' || type.type === 'null';
}

export function isTruthy(type: Type): boolean | 'maybe' {
    return (type.type === 'boolean' || type.type === 'number' || type.type === 'string') ? 'maybe' : !(type.type === 'undefined' || type.type === 'null');
}
