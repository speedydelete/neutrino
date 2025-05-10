
import {join, resolve} from 'node:path';
import {inspect} from 'node:util';
import * as fs from 'node:fs';
import {CompilerError} from './util';


type BaseSchema<T extends string> = {type: T};
type ValueSchema<T extends string, U> = BaseSchema<T> & {value?: U};
type _ObjectSchema = {type: 'object', props: {[key: PropertyKey]: Schema}};
type _ArraySchema = {type: 'array', elts: Schema | Schema[]};
type _UnionSchema = {type: 'union', schemas: Schema[]};
type _DefaultSchema = {type: 'default', schema: Schema, value: any};
type Schema = BaseSchema<'undefined' | 'null'> | ValueSchema<'boolean', boolean> | ValueSchema<'number', number> | ValueSchema<'string', string> | ValueSchema<'symbol', symbol> | ValueSchema<'bigint', bigint> | _ObjectSchema | _ArraySchema | _UnionSchema | _DefaultSchema;
type ObjectSchema<T extends {[key: PropertyKey]: Schema} = {}> = {type: 'object', props: T};
type ArraySchema<T extends Schema | Schema[] = Schema | Schema[]> = {type: 'array', elts: T};
type UnionSchema<T extends Schema[] = Schema[]> = {type: 'union', schemas: T};
// @ts-ignore
type DefaultSchema<T extends Schema = Schema, U extends MatchingSchema<T> = MatchingSchema<T>> = {type: 'default', schema: T, value: U};

function createValueSchemaFactory<T extends string, V>(type: T): {type: T, value: undefined} & ((value: V) => ValueSchema<T, V>) {
    return Object.assign((value: V) => ({type, value}), {type, value: undefined});
}

export type MatchingSchema<T extends Schema> = 
    T extends {type: 'undefined'} ? undefined :
    T extends {type: 'null'} ? null :
    T extends {type: 'boolean'} ? (T['value'] extends undefined ? boolean : T['value']) :
    T extends {type: 'number'} ? (T['value'] extends undefined ? number : T['value']) :
    T extends {type: 'string'} ? (T['value'] extends undefined ? string : T['value']) :
    T extends {type: 'symbol'} ? (T['value'] extends undefined ? symbol : T['value']) :
    T extends {type: 'bigint'} ? (T['value'] extends undefined ? bigint : T['value']) :
    T extends {type: 'object'} ? {[K in keyof T['props']]: MatchingSchema<T['props'][K]>} :
    T extends {type: 'array'} ? (T['elts'] extends Schema[] ? T['elts'] : T['elts'][]) :
    T extends {type: 'union'} ? MatchingSchema<T['schemas'][number]> :
    never;

export type _SchemaFor<T> = 
    T extends undefined ? {type: 'undefined'} :
    T extends null ? {type: 'null'} :
    T extends boolean ? {type: 'boolean', value: undefined} :
    T extends number ? {type: 'number', value: undefined} :
    T extends string ? {type: 'string', value: undefined} :
    T extends symbol ? {type: 'symbol', value: undefined} :
    T extends bigint ? {type: 'bigint', value: undefined} :
    T extends [infer A] ? {type: 'array', elts: [A]} :
    T extends [infer A, infer B] ? {type: 'array', elts: [A, B]} :
    T extends [infer A, infer B, infer C] ? {type: 'array', elts: [A, B, C]} :
    T extends [infer A, infer B, infer C, infer D] ? {type: 'array', elts: [A, B, C, D]} :
    T extends [infer A, infer B, infer C, infer D, infer E] ? {type: 'array', elts: [A, B, C, D, E]} :
    T extends (infer U)[] ? {type: 'array', elts: SchemaFor<U>} :
    T extends object ? {type: 'object', props: {[K in keyof T]: SchemaFor<T[K]>}} :
    never;

export type SchemaFor<T> = _SchemaFor<T> | {type: 'default', schema: _SchemaFor<T>, value: T};

const s = {
    undefined: {type: 'undefined'},
    null: {type: 'null'},
    boolean: createValueSchemaFactory<'boolean', boolean>('boolean'),
    number: createValueSchemaFactory<'number', number>('number'),
    string: createValueSchemaFactory<'string', string>('string'),
    symbol: createValueSchemaFactory<'symbol', symbol>('symbol'),
    bigint: createValueSchemaFactory<'bigint', bigint>('bigint'),
    object: Object.assign(function<T extends {[key: PropertyKey]: Schema}>(props: T): ObjectSchema<T> {
        return {type: 'object', props};
    }, {type: 'object' as const, props: {}}),
    array: function<T extends Schema | Schema[]>(elts: T): ArraySchema<T> {
        return {type: 'array', elts};
    },
    union: function<T extends Schema[]>(...schemas: T): UnionSchema<T> {
        return {type: 'union', schemas};
    },
    // @ts-ignore
    default: function<T extends Schema = Schema, U extends MatchingSchema<T> = MatchingSchema<T>>(schema: T, value: U): DefaultSchema<T, U> {
        return {type: 'default', schema, value};
    }
};

function stringify(value: any): string {
    return inspect(value, {breakLength: Infinity});
}

const {validate} = new class {

    key: string = '';
    value: any = undefined;

    constructor() {
        this.validate = this.validate.bind(this);
    }

    error(expected: string, isExpected: boolean = true): never {
        let msg: string;
        if (isExpected) {
            msg = `Expected ${expected}, got ${this.value}`;
            if (this.key !== '') {
                msg += ` (at ${this.key})`;
            }
        } else {
            msg = expected;
        }
        throw new CompilerError('ConfigError', msg, null);
    }

    validate(value: unknown, schema: Schema): void {
        this.value = value;
        switch (schema.type) {
            case 'undefined':
                if (value !== undefined) {
                    this.error('undefined');
                }
                break;
            case 'null':
                if (value !== null) {
                    this.error('null');
                }
                break;
            case 'boolean':
            case 'number':
            case 'string':
            case 'symbol':
            case 'bigint':
                if (typeof value !== schema.type) {
                    this.error(schema.type);
                }
                if (schema.value !== undefined) {
                    if (value !== schema.value) {
                        this.error(stringify(schema.value));
                    }
                }
                break;
            case 'object':
                if (!value || !(typeof value === 'object' || typeof value === 'function')) {
                    this.error('object');
                }
                let oldKey = this.key;
                for (let key of Reflect.ownKeys(schema.props)) {
                    if (typeof key === 'string' && key.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
                        this.key = oldKey + '.' + key;
                    } else {
                        this.key = oldKey + '[' + String(key) + ']';
                    }
                    this.validate(value[key], schema.props[key]);
                }
                this.key = oldKey;
                break;
            case 'array':
                if (!Array.isArray(value)) {
                    this.error('array');
                }
                let elts = schema.elts;
                if (Array.isArray(elts)) {
                    for (let i = 0; i < elts.length; i++) {
                        this.validate(value[i], elts[i]);
                    }
                } else {
                    value.forEach(x => this.validate(x, elts));
                }
                break;
            case 'union':
                let errors: [number, string][] = [];
                for (let i = 0; i < schema.schemas.length; i++) {
                    try {
                        this.validate(value, schema.schemas[i]);
                    } catch (error) {
                        errors.push([i, String(error)]);
                    }
                }
                if (errors.length > 0) {
                    this.error(`Cannot find match for union:\n${errors.map(([i, msg]) => `    Tried overload ${i}, got '${msg}'`).join('\n')}`, false);
                }
                break;
        }
    }

}


export interface Config {
    files: string[];
    runTsc: boolean;
    fileTypes: {[key: string]: string};
    rootDir: string;
    moduleDir: string;
}

const SCHEMA: SchemaFor<Config> = s.object({
    files: s.array(s.string),
    runTsc: s.default(s.boolean, true),
    fileTypes: s.default(s.object, {
        '.js': 'text/javascript',
        '.cjs': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.jsx': 'test/javascript-jsx',
        '.ts': 'text/typescript',
        '.tsx': 'text/typescript-jsx',
    }),
    rootDir: s.default(s.string, ''),
    moduleDir: s.default(s.string, 'node_modules'),
});

const PATHS = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'].map(x => 'neutrino.config' + x);
let configOrNull: Config | null = null;
let dir = process.cwd();
let found = false;
while (dir.length > 0) {
    for (let path of PATHS) {
        let fullPath = join(dir, path);
        if (fs.existsSync(fullPath)) {
            found = true;
            configOrNull = (await import(fullPath)).default;
            SCHEMA.props.rootDir.value = dir;
            validate(configOrNull, SCHEMA);
            break;
        }
    }
    if (found) {
        break;
    }
    dir = join(dir, '..');
}
if (configOrNull === null) {
    throw new CompilerError('ConfigError', 'Cannot find configuration file', null);
}
let config: Config = configOrNull;
export default config;


export function getAbsPath(path: string): string {
    return resolve(config.rootDir, path);
}

export function getPathFromRoot(path: string): string {
    return getAbsPath(path).slice(config.rootDir.length);
}
