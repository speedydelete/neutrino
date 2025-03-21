
import * as parser from '@babel/parser';
import * as bt from '@babel/types';
import * as fs from 'node:fs';


export const JS_ESCAPES = {
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

export function toStringLiteral(str: string): string {
    let out = '';
    for (let char of str) {
        let code = char.charCodeAt(0);
        if (code >= 0x20 && code < 0x7F) {
            out += char;
        } else if (char in JS_ESCAPES) {
            out += JS_ESCAPES[char];
        } else if (code <= 0xFF) {
            out += '\\x' + code.toString(16).padStart(2, '0');
        } else {
            out += '\\u{' + code.toString(16) + '}';
        }
    }
    return '"' + out + '"';
}


export interface Type {
    name: string;
    extends(this: Type, other: Type): boolean;
    doesExtend(this: Type, other: Type): boolean;
    toString(this: Type): string;
}

export const baseType: Type = {
    name: '__base__',
    extends(this: Type, other: Type): boolean {
        return other.doesExtend(this);
    },
    doesExtend(this: Type, other: Type): boolean {
        return this.name === other.name;
    },
    toString(this: Type): string {
        return this.name;
    },
};

// @ts-ignore
export function createType<T extends {}, U extends ((this: Type & T, ...args: any[]) => void) | undefined = undefined>(name: string, funcs: {extends?: (this: Type & T, other: Type) => boolean, doesExtend?: (this: Type & T, other: Type) => boolean, toString?: (this: Type & T) => string, call?: U} = {}): (U extends undefined ? Type : (Type & ((...args: Parameters<U>) => Type & T))) & T {
    let out: Type | (Type & (typeof funcs)['call']);
    if (funcs.call) {
        out = Object.assign(function(...args: any[]) {
            let obj = Object.create(out);
            // @ts-ignore
            funcs.call.call(obj, ...args);
            return obj;
        }, baseType);
    } else {
        out = Object.create(baseType);
    }
    out.name = name;
    if (funcs.extends !== undefined) {
        out.extends = funcs.extends.bind(out);
    }
    if (funcs.doesExtend !== undefined) {
        out.doesExtend = funcs.doesExtend.bind(out);
    }
    if (funcs.toString !== undefined) {
        out.toString = funcs.toString.bind(out);
    }
    return out as any;
}

export function createTypeWithValue<T extends unknown>(name: string, {toString, doesExtend}: {toString?: (this: Type & {value: T}) => string, doesExtend?: (this: Type & {value: T}, other: Type) => boolean} = {}): Type & {(value: T): Type & {value: T}, value: undefined} {
    if (toString === undefined) {
        toString = function() {
            return String(this.value);
        }
    }
    let out = createType<{value: T}, (value: T) => void>(name, {
        doesExtend: doesExtend ?? function(other) {
            return other.name === name && (this.value === undefined || this.value === (other as typeof this).value);
        },
        call(value: T) {
            this.value = value;
        },
    }) as any;
    return out;
}


type AnyObject = {[key: PropertyKey]: Type | undefined};

interface ObjectIndex {
    key: Type;
    value: Type;
}

interface FunctionType {
    params: [string, Type][];
    return: Type;
}

const t = {
    any: createType('any', {doesExtend() {return true;}}),
    unknown: createType('unknown', {doesExtend() {return true;}}),
    never: createType('never', {doesExtend() {return false}}),
    undefined: createType('undefined'),
    void: createType('void', {
        doesExtend(other) {
            return other.name === 'undefined' || other.name === 'void';
        }
    }),
    null: createType('null'),
    boolean: createTypeWithValue<boolean>('boolean'),
    number: createTypeWithValue<number>('number'),
    string: createTypeWithValue<string>('string'),
    bigint: createTypeWithValue<bigint>('bigint'),
    symbol: createTypeWithValue<symbol>('symbol'),
    this: createType('this'),
    object: createType<{props: AnyObject, indexes: ObjectIndex[], new: FunctionType | null}, (props: AnyObject, indexes?: ObjectIndex[]) => void>('object', {
        doesExtend(other) {
            if (!('props' in other)) {
                return false;
            } else {
                for (let key in (other as typeof this).props) {
                    // @ts-ignore
                    if (!(key in this) || !((other as typeof this).props[key].extends(this.props[key]))) {
                        return false;
                    }
                }
                return true;
            }
        },
        call(props: AnyObject, indexes: ObjectIndex[] = [], constructor?: {params: [string, Type][], return: Type}) {
            this.props = props;
            this.indexes = indexes;
            this.new = constructor ?? null;
        }
    }),
    function: createType<{props: AnyObject & {prototype: AnyObject}} & FunctionType, (params: [string, Type][], returnType: Type) => void>('function', {
        doesExtend(other) {
            if (!t.object.doesExtend.call(this, other) || !('params' in other)) {
                return false;
            }
            let otherParams = (other as unknown as typeof this).params;
            for (let i = 0; i < this.params.length; i++) {
                if (i in otherParams) {
                    let [name, type] = this.params[i];
                    let [otherName, otherType] = otherParams[i];
                    if (!(name === otherName && type.extends(otherType))) {
                        return false;
                    }
                }
            }
            return true;
        },
        toString() {
            return '(' + this.params.map(x => x.toString()).join(', ') + ') => ' + this.return.toString();
        },
        call(params: [string, Type][], returnType: Type) {
            this.params = params;
            this.return = returnType;
        },
    }),
    union: createType<{types: Type[]}, (...types: Type[]) => void>('union', {
        doesExtend(other) {
            return this.types.some(type => type.doesExtend(other));
        },
        toString() {
            let out: string[] = [];
            for (let type of this.types) {
                if (type.name === 'union' || type.name === 'intersection' || type.name === 'function') {
                    out.push('(' + type.toString() + ')');
                } else {
                    out.push(type.toString());
                }
            }
            return out.join(' | ');
        },
        call(...types: Type[]) {
            this.types = types;
        }
    }),
    intersection: createType<{types: Type[]}, (...types: Type[]) => void>('intersection', {
        doesExtend(other) {
            return this.types.every(type => type.doesExtend(other));
        },
        toString() {
            let out: string[] = [];
            for (let type of this.types) {
                if (type.name === 'union' || type.name === 'intersection' || type.name === 'function') {
                    out.push('(' + type.toString() + ')');
                } else {
                    out.push(type.toString());
                }
            }
            return out.join(' | ');
        },
        call(...types: Type[]) {
            this.types = types;
        }
    }),
    conditional: createType<({check: Type, extendsType: Type, true: Type, false: Type}), (check: Type, extendsType: Type, trueType: Type, falseType: Type) => void>('conditional', {
        doesExtend(other) {
            return (this.check.extends(this.extendsType) ? this.true : this.false).doesExtend(other);
        },
        call(check: Type, extendsType: Type, trueType: Type, falseType: Type) {
            this.check = check;
            this.extendsType = extendsType;
            this.true = trueType;
            this.false = falseType;
        },
    }),
};

export default t;


export interface Context {
    vars: {[key: string]: Type};
    modules: {[key: string]: Type};
    filename: string;
    infer?: ((node: bt.Node) => Type);
};

export function compileType(type: bt.TSType | bt.TSTypeAnnotation | bt.Noop | bt.Identifier | bt.TSQualifiedName, ctx: Context): Type {
    switch (type.type) {
        case 'TSTypeAnnotation':
            return compileType(type.typeAnnotation, ctx);
        case 'Identifier':
            if (type.typeAnnotation) {
                if (type.typeAnnotation.type === 'TypeAnnotation') {
                    throw new Error('Flow is not supported');
                }
                let out = compileType(type.typeAnnotation, ctx);
                ctx.vars[type.name] = out;
                return out;
            } else {
                if (!(type.name in ctx.vars)) {
                    throw new ReferenceError(`${type.name} is not defined`);
                }
                return ctx.vars[type.name];
            }
        case 'TSParenthesizedType':
            return compileType(type.typeAnnotation, ctx);
        case 'Noop':
        case 'TSAnyKeyword':
            return t.any;
        case 'TSUnknownKeyword':
            return t.unknown;
        case 'TSNeverKeyword':
            return t.never;
        case 'TSUndefinedKeyword':
            return t.undefined;
        case 'TSVoidKeyword':
            return t.void;
        case 'TSNullKeyword':
            return t.null;
        case 'TSBooleanKeyword':
            return t.boolean;
        case 'TSNumberKeyword':
            return t.number;
        case 'TSStringKeyword':
            return t.string;
        case 'TSBigIntKeyword':
            return t.bigint;
        case 'TSSymbolKeyword':
            return t.symbol;
        case 'TSObjectKeyword':
            return t.object;
        case 'TSThisType':
            return t.this;
        case 'TSLiteralType':
            while (type.literal.type === 'UnaryExpression') {
                type.literal = type.literal.argument as bt.NumericLiteral | bt.BooleanLiteral | bt.BigIntLiteral | bt.UnaryExpression;
            }
            switch (type.literal.type) {
                case 'BooleanLiteral':
                    return t.boolean(type.literal.value);
                case 'NumericLiteral':
                    return t.number(type.literal.value);
                case 'StringLiteral':
                    return t.string(type.literal.value);
                case 'BigIntLiteral':
                    return t.bigint(BigInt(type.literal.value));
                default:
                    throw new Error(`${type.type}s in types are not supported`);
            }
        case 'TSTypeLiteral':
            let props: AnyObject = {};
            let indexes: ObjectIndex[] = [];
            let constructor: FunctionType | null = null;
            let members = type.members;
            for (let type of members) {
                let key: string;
                if (type.type === 'TSIndexSignature') {
                } else if (type.type === 'TSCallSignatureDeclaration') {
                } else if (type.type === 'TSConstructSignatureDeclaration') {
                } else {
                    let key: string;
                    if (type.key.type === 'Identifier') {
                        key = type.key.name;
                    } else {
                        if (ctx.infer !== undefined) {
                            key = (ctx.infer(type.key) as ReturnType<typeof t.string>).value;
                        } else {
                            throw new Error('cannot determine type of computed object property, no type inferrer provided');
                        }
                    }
                    if (type.type === 'TSPropertySignature') {
                        props[key] = type.typeAnnotation ? compileType(type.typeAnnotation, ctx) : t.any;
                    }
                }
            }
        case 'TSArrayType':
            if ('Array' in ctx.vars) {
                return ctx.vars.Array;
            } else {
                throw new Error('there appears to be a problem, the Array type is not defined');
            }
        case 'TSFunctionType':
            return t.function(type.parameters.map(x => {
                switch (x.type) {
                    case 'Identifier':
                        if (!x.typeAnnotation) {
                            return [x.name, t.any];
                        }
                        if (x.typeAnnotation.type === 'TypeAnnotation') {
                            throw new Error('Flow is not supported');
                        }
                        return [x.name, compileType(x.typeAnnotation, ctx)];
                    default:
                        throw new Error(`${type.type}s are not supported`);
                }
            }), type.typeAnnotation ? compileType(type.typeAnnotation, ctx) : t.any);
        case 'TSUnionType':
            return t.union(...type.types.map(x => compileType(x, ctx)));
        case 'TSIntersectionType':
            return t.intersection(...type.types.map(x => compileType(x, ctx)));
        case 'TSConditionalType':
            return t.conditional(compileType(type.checkType, ctx), compileType(type.extendsType, ctx), compileType(type.trueType, ctx), compileType(type.falseType, ctx));
        case 'TSTypeOperator':
            switch (type.operator) {
                case 'keyof':
                    return t.union(...Object.keys(compileType(type.typeAnnotation, ctx)).map(t.string));
                default:
                    throw new Error(`${type.operator} operator is not supported`);
            }
        case 'TSTypeQuery':
            return compileType(type.exprName, ctx);
        case 'TSIndexedAccessType':
            return (compileType(type.objectType, ctx) as ReturnType<typeof t.object>);
        case 'TSImportType':
            return ctx.modules[type.argument.value];
        case 'TSMappedType':
            throw new Error('mapped types are not supported');
        case 'TSTemplateLiteralType':
            throw new Error('template literal types are not supported');
        case 'TSExpressionWithTypeArguments':
            throw new Error('generics are not supported');
        case 'TSTypePredicate':
            throw new Error('type predicates are not supported');
        case 'TSRestType':
            throw new Error('rest types are not supported');
        case 'TSIntrinsicKeyword':
            throw new Error('the intrinsic keyword is not supported');
        case 'TSInferType':
            throw new Error('the infer keyword is not supported');
        case 'TSOptionalType':
            throw new Error('what the heck is an optional type');
        case 'TSTypeReference':
            throw new Error('what the heck is a type reference');
        case 'TSQualifiedName':
            throw new Error('what the heck is a qualified name');
        default:
            throw new Error(`unrecognized node ${type.type}`);
    }
}

export function parseType(type: string, ctx: Context = {vars: {}, modules: {}, filename: 'anonymous'}): Type {
    return compileType((parser.parse('type T = ' + type).program.body[0] as bt.TSTypeAliasDeclaration).typeAnnotation, ctx);
}
