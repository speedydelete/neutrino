
export abstract class TypeClass {
    abstract type: string;
    static type: string;
    typeVars: typevar[] = [];
    static typeVars: typevar[] = [];
    resolvedTypeVars: typevar[] = [];
    static resolvedTypeVars: typevar[] = [];
    tagIndex: number = -1;
    static tagIndex: number = -1;
    specialName: string | null = null;
    static specialName: string | null = null;
    constructor(...args: unknown[]) {}
    extends(other: Type): boolean {
        return other.doesExtend(this);
    }
    doesExtend(other: Type): boolean {
        return this.type === other.type;
    }
    static extends(other: Type): boolean {
        return other.doesExtend(this);
    }
    static doesExtend(other: Type): boolean {
        return other.type === this.type;
    }
    toString(): string {
        return this.type;
    }
    static toString(): string {
        return this.type;
    }
    copy(): Type {
        // @ts-ignore
        let out: Type = new (this.constructor)();
        out.typeVars = this.typeVars;
        out.resolvedTypeVars = this.resolvedTypeVars;
        out.tagIndex = this.tagIndex;
        return out;
    }
    static copy(): Type {
        return this;
    }
    with(typeVars: {[key: string]: Type}): Type {
        let out = this.copy();
        let newTypeVars: typevar[] = [];
        for (let i = 0; i < this.typeVars.length; i++) {
            let typeVar = this.typeVars[i];
            if (typeVar.name in typeVars) {
                out.resolvedTypeVars.push(new typevar(typeVar.name, typeVar.constraint, typeVars[typeVar.name]));
            } else {
                newTypeVars.push(typeVar);
            }
        }
        out.typeVars = newTypeVars;
        return out;
    }
    static with(typeVars: {[key: string]: Type}): Type {
        return this;
    }
    getResolvedTypeVar(name: string): typevar {
        return this.typeVars.filter(tv => tv.name === name)[0];
    }
    static getResolvedTypeVar(name: string): typevar {
        return this.typeVars.filter(tv => tv.name === name)[0];
    }
}

export class typevar extends TypeClass {
    type = 'typevar';
    static type = 'typevar';
    name: string;
    constraint: Type;
    default: Type | null;
    constructor(name: string, constraint?: Type | null, defaultValue?: Type | null) {
        super();
        this.name = name;
        this.constraint = constraint ?? any_;
        this.default = defaultValue ?? null;
    }
    copy(): typevar {
        return new typevar(this.name, this.constraint);
    }
    extends(type: Type) {
        return this.constraint.extends(type);
    }
    with(typeVars: {[key: string]: Type}): Type {
        TypeClass.prototype.with.call(this, typeVars);
        for (let name in typeVars) {
            if (name === this.name) {
                return typeVars[name];
            }
        }
        return this;
    }
}

export type Type = TypeClass | typeof TypeClass;


export class any_ extends TypeClass {
    type = 'any';
    static type = 'any';
    extends(other: Type): boolean {
        return true;
    }
    doesExtend(other: Type): boolean {
        return true;
    }
    static extends(other: Type): boolean {
        return true;
    }
    static doesExtend(other: Type): boolean {
        return true;
    }
}

export class unknown_ extends TypeClass {
    type = 'unknown';
    static type = 'unknown';
    doesExtend(other: Type): boolean {
        return true;
    }
    static doesExtend(other: Type): boolean {
        return true;
    }
}

export class never_ extends TypeClass {
    type = 'never';
    static type = 'never';
    static doesExtend(other: Type): boolean {
        return false;
    }
}


export class undefined_ extends TypeClass {
    type = 'undefined';
    static type = 'undefined';
}

export class void_ extends TypeClass {
    type = 'void';
    static type = 'void';
    static doesExtend(other: Type): boolean {
        return other.type === 'void' || other.type === 'undefined';
    }
}

export class null_ extends TypeClass {
    type = 'null';
    static type = 'null';
}


export class boolean_ extends TypeClass {
    type = 'boolean';
    static type = 'boolean';
    value: boolean;
    constructor(value: boolean) {
        super();
        this.value = value;
    }
    doesExtend(other: Type): boolean {
        return other instanceof boolean_ && other.value === this.value;
    }
    toString(): string {
        return this.value.toString();
    }
    copy(): boolean_ {
        return new boolean_(this.value);
    }
}
export const true_ = new boolean_(true);
export const false_ = new boolean_(false);


export class number_ extends TypeClass {
    type = 'number';
    static type = 'number';
    value: number;
    constructor(value: number) {
        super();
        this.value = value;
    }
    doesExtend(other: Type): boolean {
        return other instanceof number_ && other.value === this.value;
    }
    toString(): string {
        return this.value.toString();
    }
    copy(): number_ {
        return new number_(this.value);
    }
}


const JS_ESCAPES: {[key: string]: string} = {
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
function toStringLiteral(value: string): string {
    let out = '';
    for (let char of value) {
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


export class string_ extends TypeClass {
    type = 'string';
    static type = 'string';
    value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }
    doesExtend(other: Type): boolean {
        return other instanceof string_ && other.value === this.value;
    }
    toString(): string {
        return toStringLiteral(this.value);
    }
    copy(): string_ {
        return new string_(this.value);
    }
}

export class symbol_ extends TypeClass {
    type = 'symbol';
    static type = 'symbol';
    value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }
    static doesExtend(other: Type): boolean {
        return other.type === 'symbol';
    }
    doesExtend(other: Type): boolean {
        return other === this;
    }
    toString(): string {
        return 'unique symbol';
    }
}

export class bigint_ extends TypeClass {
    type = 'bigint';
    static type = 'bigint';
    value: bigint;
    constructor(value: bigint) {
        super();
        this.value = value;
    }
    doesExtend(other: Type): boolean {
        return other instanceof bigint_ && other.value === this.value;
    }
    toString(): string {
        return this.value + 'n';
    }
    copy(): bigint_ {
        return new bigint_(this.value);
    }
}

export class functionsig extends TypeClass {
    type = 'functionsig';
    static type = 'functionsig';
    params: [string, Type][] = [];
    returnType: Type;
    restParam: [string, Type] | null;
    constructor(params?: [string, Type][], returnType?: Type, restParam?: [string, Type] | null) {
        super();
        this.params = params ?? [];
        this.returnType = returnType ?? any_;
        this.restParam = restParam ?? null;
    }
    doesExtend(other: Type): boolean {
        if (!(other instanceof functionsig)) {
            return false;
        }
        if (other.params.length < this.params.length) {
            return false;
        }
        for (let i = 0; i < this.params.length; i++) {
            if (!(other.params[i][1].doesExtend(this.params[i][1]))) {
                return false;
            }
        }
        return this.returnType.doesExtend(other.returnType) && this.restParam === other.restParam; 
    }
    toString(): string {
        return `(${this.params.map(([name, type]) => `${name}: ${type}`).join(', ')}): ${this.returnType}`;
    }
    toStringArrow(): string {
        return `(${this.params.map(([name, type]) => `${name}: ${type}`).join(', ')}) => ${this.returnType}`;
    }
    with(typeVars: {[key: string]: Type}): Type {
        let params = this.params.map(([name, type]) => [name, type.with(typeVars)]) as [string, Type][];
        let returnType = this.returnType.with(typeVars);
        return new functionsig(params, returnType, this.restParam);
    }
}

export class object_ extends TypeClass {
    type = 'object';
    static type = 'object';
    props: {[key: PropertyKey]: Type};
    indexes: [string, Type, Type][] = [];
    call: functionsig | null = null;
    construct: functionsig | null = null;
    constructor(props: {[key: PropertyKey]: Type} = {}, indexes: [string, Type, Type][] = []) {
        super();
        this.props = props;
        this.indexes = indexes;
    }
    doesExtend(other: Type): boolean {
        if (!(other instanceof object_)) {
            return false;
        }
        let keys = Reflect.ownKeys(this.props);
        let otherKeys = Reflect.ownKeys(other.props);
        if (!keys.every(key => otherKeys.includes(key))) {
            return false;
        }
        for (let key of keys) {
            if (!this.props[key].extends(other.props[key])) {
                return false;
            }
        }
        return true;
    }
    toString(): string {
        let props: string[] = [];
        for (let key of Reflect.ownKeys(this.props)) {
            let strKey: string;
            if (typeof key === 'string') {
                strKey = key.match(/^[a-zA-Z0-9_$]+$/) ? key : toStringLiteral(key);
            } else {
                let symbolKey = Symbol.keyFor(key);
                strKey = symbolKey === undefined ? '[unique symbol]' : `[Symbol.for(${toStringLiteral(symbolKey)})]`;
            }
            props.push(strKey + ': ' + this.props[key].toString());
        }
        for (let [name, constraint, type] of this.indexes) {
            props.push(`[${name}: ${constraint}]: ${type}`);
        }
        if (props.length === 0 && !(this.call && this.construct)) {
            if (this.call) {
                return this.call.toStringArrow();
            } else if (this.construct) {
                return this.construct.toStringArrow();
            } else {
                return '{}';
            }
        }
        if (this.call) {
            props.push(this.call.toString());
        }
        if (this.construct) {
            props.push('new ' + this.construct.toString());
        }
        let out = '{\n';
        for (let prop of props) {
            for (let line of prop.split('\n')) {
                out += '    ' + line + '\n';
            }
        }
        return out + '}';
    }
    copy(): object_ {
        return Object.assign(new object_(this.props), {
            call: this.call?.copy(),
            construct: this.construct?.copy(),
        });
    }
    with(typeVars: {[key: string]: Type}): object_ {
        TypeClass.prototype.with.call(this, typeVars);
        let props: {[key: PropertyKey]: Type} = {};
        for (let name of Reflect.ownKeys(this.props)) {
            this.props[name] = this.props[name].with(typeVars);
        }
        return Object.assign(new object_(props), {
            call: this.call?.with(typeVars),
            construct: this.construct?.with(typeVars),
        });
    }
}


export class union extends TypeClass {
    type = 'union';
    static type = 'union';
    types: Type[];
    tagIndex: number = -1;
    constructor(...types: Type[]) {
        super();
        this.types = types;
    }
    doesExtend(other: Type): boolean {
        return this.types.some(type => other.extends(type));
    }
    toString(): string {
        return this.types.join(' | ');
    }
    copy(): union {
        return Object.assign(new union(...this.types.map(type => type.copy())), {tagIndex: this.tagIndex});
    }
    with(typeVars: {[key: string]: Type}): union {
        TypeClass.prototype.with.call(this, typeVars);
        return new union(...this.types.map(type => type.with(typeVars)));
    }
}

export class intersection extends TypeClass {
    type = 'intersection';
    static type = 'intersection';
    types: Type[];
    constructor(...types: Type[]) {
        super();
        this.types = types;
    }
    doesExtend(other: Type): boolean {
        return this.types.every(type => other.extends(type));
    }
    copy(): intersection {
        return new intersection(...this.types.map(type => type.copy()));
    }
    with(typeVars: {[key: string]: Type}): intersection {
        TypeClass.prototype.with.call(this, typeVars);
        return new intersection(...this.types.map(type => type.with(typeVars)));
    }
}


export {
    any_ as any,
    unknown_ as unknown,
    never_ as never,
    undefined_ as undefined,
    void_ as void,
    null_ as null,
    boolean_ as boolean,
    true_ as true,
    false_ as false,
    number_ as number,
    string_ as string,
    symbol_ as symbol,
    bigint_ as bigint,
    object_ as object,
};
