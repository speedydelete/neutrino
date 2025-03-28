
export abstract class TypeClass {
    abstract type: string;
    static type: string;
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
}

export type Type = TypeClass | typeof TypeClass;


export class any_ extends TypeClass {
    type: 'any';
    static type: 'any';
    doesExtend(other: Type): boolean {
        return true;
    }
}

export class unknown_ extends TypeClass {
    type: 'unknown';
    static type: 'unknown';
    doesExtend(other: Type): boolean {
        return true;
    }
}

export class never_ extends TypeClass {
    type: 'never';
    static type: 'never';
    doesExtend(other: Type): boolean {
        return false;
    }
}


export class undefined_ extends TypeClass {
    type: 'undefined';
    static type: 'undefined';
}

export class void_ extends TypeClass {
    type: 'void';
    static type: 'void';
    doesExtend(other: Type): boolean {
        return other.type === 'void' || other.type === 'undefined';
    }
}

export class null_ extends TypeClass {
    type: 'null';
    static type: 'null';
}


export class boolean_ extends TypeClass {
    type: 'boolean';
    static type: 'boolean';
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
}
export const true_ = new boolean_(true);
export const false_ = new boolean_(false);


export class number_ extends TypeClass {
    type: 'number';
    static type: 'number';
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
}


const JS_ESCAPES = {
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
    type: 'string';
    static type: 'string';
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
}

export class symbol_ extends TypeClass {
    type: 'symbol';
    static type: 'symbol';
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
    type: 'bigint';
    static type: 'bigint';
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
}

export class object_ extends TypeClass {
    type: 'object';
    static type: 'object';
    props: {[key: PropertyKey]: Type};
    params: [string, Type][] = [];
    returnType: Type | null = null;
    constructorParams: [string, Type][] = [];
    constructorReturnType: Type | null = null;
    constructor(props: {[key: PropertyKey]: Type} = {}) {
        super();
        this.props = props;
    }
    toString(): string {
        let props: string[] = [];
        for (let [key, type] of Object.entries(this.props)) {
            props.push(key.match(/^[a-zA-Z0-9_$]+$/) ? key : toStringLiteral(key) + ': ' + type.toString());
        }
        if (props.length === 0 && !(this.returnType !== null && this.constructorReturnType !== null)) {
            if (this.returnType !== null) {
                return '(' + this.params.map(x => x[0] + ': ' + x[1].toString()).join(', ') + ' => ' + this.returnType.toString()
            } else if (this.constructorReturnType !== null) {
                return '(' + this.constructorParams.map(x => x[0] + ': ' + x[1].toString()).join(', ') + ' => ' + this.constructorReturnType.toString()
            } else {
                return '{}';
            }
        }
        if (this.returnType !== null) {
            props.push('(' + this.params.map(x => x[0] + ': ' + x[1].toString()).join(',') + '): ' + this.returnType.toString());
        }
        if (this.constructorReturnType !== null) {
            props.push('new (' + this.constructorParams.map(x => x[0] + ': ' + x[1].toString()).join(',') + '): ' + this.constructorReturnType.toString());
        }
        let out = '{\n';
        for (let prop of props) {
            for (let line of prop.split('\n')) {
                out += '    ' + line;
            }
        }
        return out + '\n}';
    }
}


export class union extends TypeClass {
    type: 'union';
    static type: 'union';
    types: Type[];
    tagIndex: number = -1;
    constructor(...types: Type[]) {
        super();
        this.types = types;
    }
    doesExtend(other: Type): boolean {
        return this.types.some(type => other.extends(type));
    }
}

export class intersection extends TypeClass {
    type: 'intersection';
    static type: 'intersection';
    types: Type[];
    constructor(...types: Type[]) {
        super();
        this.types = types;
    }
    doesExtend(other: Type): boolean {
        return this.types.every(type => other.extends(type));
    }
}

export class typevar extends TypeClass {
    type: 'typevar';
    static type: 'typevar';
    name: string;
    constraint: Type;
    constructor(name: string, constraint: Type) {
        super();
        this.name = name;
        this.constraint = constraint;
    }
    extends(type: Type) {
        return this.constraint.extends(type);
    }
}

export class generic extends TypeClass {
    type: 'generic';
    static type: 'generic';
    typevars: typevar[];
    value: Type;
    resolved: boolean;
    constructor(value: Type, typevars: typevar[], resolved: boolean = false) {
        super();
        this.value = value;
        this.typevars = typevars;
        this.resolved = resolved;
    }
    extends(other: Type): boolean {
        return this.value.extends(other);
    }
    resolve(...types: Type[]) {
        let typevars = types.map((type, i) => new typevar(this.typevars[i].name, type));
        return new generic(this.value, typevars, true);
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
