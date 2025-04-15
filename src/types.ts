
import {highlight} from './highlighter'


export interface BaseType<T extends string = string> {
    type: T;
    extends(other: Type): boolean;
    doesExtend(other: Type): boolean;
    toString(colors?: boolean): string;
    _toString(): string;
}

function Type<T extends string>(name: T, toString: (this: Type) => string, data: Partial<Omit<Type, 'type' | 'toString'>> = {}): void {
    this.name = name;
    this._toString = toString;
    Object.assign(this, data);
}
Type.prototype.extends = function(other: Type) {
    return other.doesExtend(this);
}
Type.prototype.toString = function(colors: boolean = false) {
    let out = this._toString();
    return colors ? highlight(out) : out;
}


export interface Any extends BaseType<'any'> {
    extends(other: Type): true;
}

export interface Unknown extends BaseType<'unknown'> {
    extends(other: Type): other is Unknown;
}

type AU = Any | Unknown;

export interface Never extends BaseType<'never'> {
    extends(other: Type): false;
}

export interface Void extends BaseType<'void'> {
    extends(other: Type): other is Void | Undefined | AU;
}

export interface Undefined extends BaseType<'undefined'> {
    extends(other: Type): other is Undefined | Void | AU;
}

export interface Null extends BaseType<'null'> {
    extends(other: Type): other is Null | AU;
}


export const any: Any = new Type('any', () => 'any', {
    extends() {return true},
    doesExtend() {return true},
});

export const unknown: Unknown = new Type('unknown', () => 'unknown', {
    extends(other) {return other.type === 'unknown'},
    doesExtend() {return true},
});

export const never: Never = new Type('never', () => 'never', {
    extends() {return false},
    doesExtend() {return false},
});

const void_: Void = new Type('void', () => 'void', {
    doesExtend(other) {return other.type === 'void' || other.type === 'undefined'},
});

const undefined_: Undefined = new Type('undefined', () => 'undefined', {
    doesExtend(other) {return other.type === 'undefined' || other.type === 'void'},
});

const null_: Null = new Type('null', () => 'null', {
    doesExtend(other) {return other.type === 'null'},
});

export {
    void_ as void,
    undefined_ as undefined,
    null_ as null,
}



export type Type = Any | Unknown | Never | Void | Undefined | Null;
