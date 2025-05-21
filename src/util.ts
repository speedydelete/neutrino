
import { join, dirname} from 'node:path';
import type * as b from '@babel/types';
import * as t from './types.js';
import {Type} from './types.js';
import {highlight} from './highlighter.js';


export function changeExtension(path: string, ext: string): string {
    let dir = dirname(path);
    path = path.slice(dir.length + 1);
    if (path.startsWith('.')) {
        path = path.slice(0, path.slice(1).indexOf('.'));
    } else {
        path = path.slice(0, path.indexOf('.'));
    }
    return join(dir, path) + ext;
}


export interface SourceData {
    raw: string;
    fullRaw: string;
    file: string;
    line: number;
    col: number;
}

export class CompilerError extends Error {

    [Symbol.toStringTag] = 'CompilerError' as const;

    type: string;

    src: (SourceData & { rawLine: string }) | null;

    constructor(type: string, message: string, src: SourceData | null) {
        super(message);
        this.type = type;
        if (!src) {
            this.src = src;
        } else {
            this.src = Object.assign({}, src, { rawLine: src.fullRaw.split('\n')[src.line - 1] });
        }
    }

    toString(): string {
        let src = this.src;
        if (!src) {
            return `${this.type}: ${this.message}`;
        }
        let out = `${this.type}: ${this.message} (at ${src.file}:${src.line}:${src.col})\n`;
        out += '    ' + src.rawLine + '\n';
        out += '    ' + ' '.repeat(src.col) + '^'.repeat(src.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

    toStringHighlighted(): string {
        let src = this.src;
        if (!src) {
            return `${this.type}: ${this.message}`;
        }
        let out = `\x1b[91m${this.type}\x1b[0m: ${this.message} (at ${src.file}:${src.line}:${src.col})\n`;
        out += '    ' + highlight(src.rawLine) + '\n';
        out += '    ' + ' '.repeat(src.col) + '^'.repeat(src.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

}


export class Stack<T> {

    values: T[];
    sourceData: SourceData | null;

    constructor(values: T[] = [], sourceData: SourceData | null = null) {
        this.values = values;
        this.sourceData = sourceData;
    }

    get value(): T | undefined {
        return this.values[this.values.length - 1];
    }

    get length(): number {
        return this.values.length;
    }

    push(value: T): void {
        this.values.push(value);
    }

    pop(): T {
        let out = this.values.pop();
        if (out === undefined) {
            throw new CompilerError('InternalError', 'Nothing to pop', this.sourceData);
        }
        return out;
    }

    copy(): Stack<T> {
        return new Stack(this.values, this.sourceData);
    }

}


export class Scope {

    parent: Scope | null;
    vars: Map<string, Type> = new Map();
    types: Map<string, Type> = new Map();
    exports: Map<string, [Type, string]> = new Map();
    imports: Set<string> = new Set();
    thisTypes: Stack<Type>;
    superTypes: Stack<Type>;

    constructor(parent: Scope | null = GLOBAL_SCOPE) {
        if (parent instanceof Scope) {
            this.exports = parent.exports;
            this.imports = parent.imports;
            this.thisTypes = parent.thisTypes.copy();
            this.superTypes = parent.superTypes.copy();
        } else {
            this.thisTypes = new Stack();
            this.superTypes = new Stack();
        }
        this.parent = parent;
    }

    get(sourceData: SourceData, name: string): Type {
        let type = this.vars.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.get(sourceData, name);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, sourceData);
        }
    }

    has(name: string): boolean {
        return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
    }

    set(name: string, type: Type): void {
        this.vars.set(name, type);
    }

    getType(sourceData: SourceData, name: string): Type {
        let type = this.types.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.getType(sourceData, name);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, sourceData);
        }
    }

    hasType(name: string): boolean {
        return this.types.has(name) || (this.parent ? this.parent.hasType(name) : false);
    }

    setType(name: string, type: Type): void {
        this.types.set(name, type);
    }

    export(sourceData: SourceData, name: string, exported?: string, type?: Type): void {
        if (this.exports.has(name)) {
            throw new CompilerError('TypeError', `Cannot re-export ${name}`, sourceData);
        }
        this.exports.set(exported ?? name, [type ?? this.get(sourceData, name), name]);
    }

    exportDefault(type: Type): void {
        this.exports.set('default', [type, 'default']);
    }

    globalExists(name: string): boolean {
        if (!this.parent) {
            return this.vars.has(name);
        } else {
            return this.parent.globalExists(name);
        }
    }

    globalIsShadowed(name: string): boolean {
        if (!this.parent) {
            return false;
        }
        if (this.vars.has(name)) {
            return this.parent.globalExists(name);
        } else {
            return this.parent.globalIsShadowed(name);
        }
    }

}


export const GLOBAL_SCOPE: Scope = new Scope(null);


export class ASTManipulator {

    fullPath: string = '';
    raw: string = '';
    sourceData: SourceData = {
        raw: '',
        fullRaw: '',
        file: '',
        line: -1,
        col: -1,
    }
    scope: Scope;
    globalScope: Scope = GLOBAL_SCOPE;
    connectedManipulators: ASTManipulator[] = [];

    constructor(fullPath: string, raw: string, scope?: Scope) {
        this.fullPath = fullPath;
        this.raw = raw;
        this.sourceData.fullRaw = raw;
        this.scope = scope ?? new Scope(GLOBAL_SCOPE);
    }

    createStack<T>(values: T[] = []): Stack<T> {
        return new Stack(values, this.sourceData);
    }

    new<T extends typeof ASTManipulator>(subclass: T): InstanceType<T> {
        let out = new subclass(this.fullPath, this.raw, this.scope);
        out.sourceData = this.sourceData;
        this.connectedManipulators.push(out);
        // @ts-ignore
        return out;
    }

    getVar(name: string): Type {
        return this.scope.get(this.sourceData, name);
    }

    getGlobalVar(name: string): Type {
        return GLOBAL_SCOPE.get(this.sourceData, name);
    }

    varExists(name: string): boolean {
        return this.scope.has(name);
    }

    globalVarExists(name: string): boolean {
        return GLOBAL_SCOPE.has(name);
    }

    setVar(name: string, type: Type): void {
        this.scope.set(name, type);
    }

    getTypeVar(name: string): Type {
        return this.scope.getType(this.sourceData, name);
    }

    getGlobalTypeVar(name: string): Type {
        return GLOBAL_SCOPE.getType(this.sourceData, name);
    }

    typeVarExists(name: string): boolean {
        return this.scope.hasType(name);
    }

    setTypeVar(name: string, type: Type): void {
        this.scope.setType(name, type);
    }

    export(name: string, exported?: string, type?: Type): void {
        this.scope.export(this.sourceData, name, exported, type);
    }

    exportDefault(type: Type): void {
        this.scope.exportDefault(type);
    }

    globalIsShadowed(name: string): boolean {
        return this.scope.globalIsShadowed(name);
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
        for (let instance of this.connectedManipulators) {
            instance.scope = this.scope;
        }
    }

    popScope(): void {
        if (!this.scope.parent) {
            this.error('InternalError', 'Attempting to pop scope when no higher scope is available');
        }
        this.scope = this.scope.parent;
        for (let instance of this.connectedManipulators) {
            instance.scope = this.scope;
        }
    }

    getProp(type: Type, key: PropertyKey | Type): Type {
        switch (type.type) {
            case 'undefined':
            case 'null':
                this.error('TypeError', `Cannot read properties of ${type.type} (reading ${String(key)})`);
            case 'boolean':
                return this.getProp(this.getGlobalTypeVar('Boolean'), key);
            case 'number':
                return this.getProp(this.getGlobalTypeVar('Number'), key);
            case 'string':
                return this.getProp(this.getGlobalTypeVar('String'), key);
            case 'symbol':
                return this.getProp(this.getGlobalTypeVar('Symbol'), key);
            case 'object':
                if (typeof key !== 'object') {
                    return type.props[key] ?? t.undefined;
                } else if (key.type === 'string-value' || key.type === 'number-value') {
                    return type.props[key.value];
                } else {
                    for (let index of type.indexes) {
                        if (index.key.isCompatible(key)) {
                            return index.value;
                        }
                    }
                    return t.undefined;
                }
            default:
                return t.any;
        }
    }

    setProp(type: Type, key: PropertyKey | Type, value: Type): Type {
        switch (type.type) {
            case 'any':
                return t.any;
            case 'object':
                if (typeof key !== 'object') {
                    type.props[key] = value;
                } else {
                    for (let index of type.indexes) {
                        if (index.key.isCompatible(key)) {
                            index.value = value;
                            return type;
                        }
                    }
                    type.indexes.push({name: 'key', key, value});
                }
            default:
                this.error('TypeError', `Cannot set properties of ${type.type} (setting ${String(key)})`);
        }
    }

    call(obj: Type): Type {
        if (obj.type !== 'object') {
            this.error('TypeError', `Value of type ${obj} is not a function`);
        } else if (!obj.call) {
            this.error('TypeError', 'Is not a function');
        } else if (obj.specialName === 'symbolFunction') {
            return t.symbol();
        } else {
            return obj.call.returnType;
        }
    }

    keyof(type: Type): Type {
        switch (type.type) {
            case 'undefined':
                this.error('TypeError', `Cannot read properties of ${type.type}`);
            case 'null':
            case 'boolean':
                return this.keyof(this.getGlobalTypeVar('Boolean'));
            case 'number':
                return this.keyof(this.getGlobalTypeVar('Number'));
            case 'string':
                return this.keyof(this.getGlobalTypeVar('String'));
            case 'symbol':
                return this.keyof(this.getGlobalTypeVar('Symbol'));
            case 'object':
                return t.union(Object.keys(type.props).map(t.string), type.indexes.map(x => x.key));
            default:
                return t.any;
        }
    }

}
