
import type * as b from '@babel/types';
import * as t from './types';
import {Type} from './types';
import {highlight} from './highlighter';


export interface SourceData {
    raw: string;
    file: string;
    line: number;
    col: number;
}

export class CompilerError extends Error implements SourceData {

    [Symbol.toStringTag] = 'CompilerError' as const;

    type: string;

    raw: string;
    rawLine: string;
    file: string;
    line: number;
    col: number;

    constructor(type: string, message: string, src: SourceData) {
        super(message);
        this.type = type;
        this.raw = src.raw;
        this.rawLine = src.raw.split('\n')[0];
        this.file = src.file;
        this.line = src.line;
        this.col = src.col;
    }

    toString(): string {
        let out = `${this.type}: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + this.rawLine + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

    toStringHighlighted(): string {
        let out = `\x1b[91m${this.type}\x1b[0m: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + highlight(this.rawLine) + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

}


export class Scope {

    parent: Scope | null;
    isFunction: boolean;
    vars: Map<string, Type> = new Map();
    types: Map<string, Type> = new Map();
    exports: {[key: string]: Type} = {};
    sourceData: SourceData;

    constructor(sourceData: SourceData, isFunction?: boolean);
    constructor(parent: Scope, isFunction?: boolean);
    constructor(parent: Scope | SourceData, isFunction: boolean = false) {
        if (parent instanceof Scope) {
            this.parent = parent;
            this.sourceData = parent.sourceData;
            this.exports = this.parent.exports;
        } else {
            this.parent = null;
            this.sourceData = parent;
        }
        this.isFunction = isFunction;
    }

    get(name: string): Type {
        let type = this.vars.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.get(name);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, this.sourceData);
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
            throw new CompilerError('ReferenceError', `${name} is not defined`, this.sourceData);
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

    export(name: string, exported?: string, type?: Type): void {
        if (name in this.exports) {
            throw new CompilerError('TypeError', `Cannot re-export ${name}`, this.sourceData);
        }
        this.exports[exported ?? name] = type ?? this.get(name);
    }

    exportDefault(type: Type): void {
        this.exports.default = type;
    }

}


export class ASTManipulator {

    fullPath: string;
    raw: string;
    sourceData: SourceData = {
        raw: '',
        file: '',
        line: -1,
        col: -1,
    }
    scope: Scope;
    connectedSubclassInstances: ASTManipulator[] = [];

    constructor(fullPath: string, raw: string, scope?: Scope) {
        this.fullPath = fullPath;
        this.raw = raw;
        this.scope = scope ?? new Scope(this.sourceData);
        for (let key in this) {
            if (typeof this[key] === 'function') {
                this[key] = this[key].bind(this);
            }
        }
    }

    newConnectedSubclass<T extends typeof ASTManipulator>(subclass: T): InstanceType<T> {
        let out = new subclass(this.fullPath, this.raw, this.scope);
        out.sourceData = this.sourceData;
        this.connectedSubclassInstances.push(out);
        // @ts-ignore
        return out;
    }

    getRaw(node: b.Node): string {
        if (!node.loc) {
            throw new Error('Node.loc is missing');
        }
        return this.raw.slice(node.loc.start.index, node.loc.end.index);
    }

    setSourceData(node: b.Node): void {
        if (!node.loc) {
            throw new Error('Node.loc is missing');
        }
        this.sourceData.raw = this.getRaw(node);
        this.sourceData.file = node.loc.filename;
        this.sourceData.line = node.loc.start.line;
        this.sourceData.col = node.loc.start.column;
    }

    error(type: string, message: string): never {
        throw new CompilerError(type, message, this.sourceData);
    }

    pushScope(): void {
        this.scope = new Scope(this.scope);
        for (let sc of this.connectedSubclassInstances) {
            sc.scope = this.scope;
        }
    }

    popScope(): void {
        if (!this.scope.parent) {
            this.error('InternalError', 'Attempting to pop scope when no higher scope is available');
        }
        this.scope = this.scope.parent;
        for (let sc of this.connectedSubclassInstances) {
            sc.scope = this.scope;
        }
    }

    resolveIntersection(...types: t.Type[]): t.Object | t.Any {
        // @ts-ignore
        return t.resolveObjectIntersection(...t.union(...types.map(this.toObjectType)).types);
    }

    toObjectTypeOrUnion(type: Type, optional?: false): t.Object | t.Any | t.Union;
    toObjectTypeOrUnion(type: Type, optional: true): t.Object | t.Any | t.Union | t.Undefined | t.Null;
    toObjectTypeOrUnion(type: Type, optional: boolean): t.Object | t.Any | t.Union | t.Undefined | t.Null;
    toObjectTypeOrUnion(type: Type, optional: boolean = false): t.Object | t.Any | t.Union {
        if (type.type === 'unknown' || type.type === 'never' || type.type === 'undefined' || type.type === 'null' || type.type === 'void') {
            if (optional) {
                // @ts-ignore
                return type;
            } else {
                this.error('TypeError', 'Cannot read properties of ' + (type.type === 'void' ? 'undefined' : type.type));
            }
        } else if (type.type === 'union') {
            return t.union(...type.types.map(x => this.toObjectTypeOrUnion(x, optional)));
        } else if (type.type === 'intersection') {
            return this.resolveIntersection(...type.types);
        } else if (type.type === 'boolean' || type.type === 'number' || type.type === 'string' || type.type === 'symbol' || type.type === 'bigint') {
            let typeName = type.type[0].toUpperCase() + type.type.slice(1);
            let out = this.scope.getType(typeName);
            if (out.type !== 'object') {
                this.error('TypeError', `Type ${typeName} must be an object type`);
            }
            return out;
        } else {
            return type;
        }
    }

    resolveObjectUnion(objs: t.Union): t.Object | t.Any {
        let props: t.Object['props'] = {};
        for (let type of objs.types) {
            let casted = this.toObjectTypeOrUnion(type);
            if (casted.type === 'union') {
                casted = this.resolveObjectUnion(casted);
            }
            if (casted.type === 'any') {
                return t.any;
            }
            for (let key in casted.props) {
                if (key in props) {
                    props[key] = t.union(props[key], casted.props[key]);
                } else {
                    props[key] = casted.props[key];
                }
            }
            for (let key in props) {
                if (!(key in casted.props)) {
                    props[key] = t.union(props[key], t.undefined);
                }
            }
        }
    }

    toObjectType(type: Type, optional?: false): t.Object | t.Any;
    toObjectType(type: Type, optional: true): t.Object | t.Any | t.Undefined | t.Null;
    toObjectType(type: Type, optional: boolean): t.Object | t.Any | t.Undefined | t.Null;
    toObjectType(type: Type, optional: boolean = false): t.Object | t.Any {
        let obj = this.toObjectTypeOrUnion(type, optional);
        if (obj.type === 'undefined' || obj.type === 'null') {
            // @ts-ignore
            return obj;
        } else if (obj.type === 'union') {
            return this.resolveObjectUnion(obj);
        } else if (obj.type === 'any') {
            return t.any;
        } else {
            return obj;
        }
    }
    

    getProp(obj: Type, prop: Type | PropertyKey, optional: boolean = false): Type {
        obj = this.toObjectType(obj, optional);
        if (typeof prop === 'string') {
            prop = t.string(prop);
        } else if (typeof prop === 'symbol') {
            prop = t.symbol(prop);
        } else if (typeof prop === 'number') {
            prop = t.number(prop);
        }
        if (obj.type !== 'object') {
            return obj;
        } else if (prop.type === 'string' || prop.type === 'number' || prop.type === 'symbol') {
            if ('value' in prop) {
                return obj.props[prop.value];
            } else {
                for (let [_, key, value] of obj.indexes) {
                    if (t.matches(prop, key)) {
                        return value;
                    }
                }
                return t.undefined;
            }
        } else {
            return t.any;
        }
    }

    call(obj: t.Type, optional?: boolean): Type {
        obj = this.toObjectType(obj, optional);
        if (obj.type !== 'object') {
            return obj;
        } else if (obj.call === null) {
            this.error('TypeError', `Object of type ${obj} is not callable`);
        } else {
            return obj.call.returnType;
        }
    }

    construct(obj: t.Type, optional?: boolean): Type {
        obj = this.toObjectType(obj, optional);
        if (obj.type !== 'object') {
            return t.any;
        } else if (obj.construct === null) {
            this.error('TypeError', `Object of type ${obj} is not constructable`);
        } else {
            return obj.construct.returnType;
        }
    }

}
