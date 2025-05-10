
import {inspect} from 'node:util';
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import {Scope, ASTManipulator} from './util';
import {utimes} from 'node:fs';


export interface Config {
    files: string[];
    runTsc: boolean;
}

export const DEFAULT_CONFIG: Exclude<Config, 'files'> = {
    files: [],
    runTsc: false,
};


type BaseSchema<T extends string> = {type: T};
type ValueSchema<T extends string, U> = BaseSchema<T> & {value?: U};
type ObjectSchema = {type: 'object', props: {[key: PropertyKey]: Schema}};
type ArraySchema = {type: 'array', elts: Schema | Schema[]};
type UnionSchema = {type: 'union', schemas: Schema[]};
type Schema = BaseSchema<'undefined' | 'null'> | ValueSchema<'boolean', boolean> | ValueSchema<'number', number> | ValueSchema<'string', string> | ValueSchema<'symbol', symbol> | ValueSchema<'bigint', bigint> | ObjectSchema | ArraySchema | UnionSchema;

function createValueSchemaFactory<T extends string, V>(type: T): ValueSchema<T, V> & ((value: V) => ValueSchema<T, V>) {
    return Object.assign((value: V) => ({type, value}), {type});
}

const s = {
    undefined: {type: 'undefined'},
    null: {type: 'null'},
    boolean: createValueSchemaFactory<'boolean', boolean>('boolean'),
    number: createValueSchemaFactory<'boolean', boolean>('boolean'),
    string: createValueSchemaFactory<'boolean', boolean>('boolean'),
    symbol: createValueSchemaFactory<'boolean', boolean>('boolean'),
    bigint: createValueSchemaFactory<'boolean', boolean>('boolean'),
    object: Object.assign(function(props: {[key: PropertyKey]: Schema}): ObjectSchema {
        return {type: 'object', props};
    }, {type: 'object', props: {}}),
    array: function(elts: Schema | Schema[]): ArraySchema {
        return {type: 'array', elts};
    },
    union: function(...schemas: Schema[]): UnionSchema {
        return {type: 'union', schemas};
    },
};

const SCHEMA: Schema = s.object({
    files: s.array(s.string),
    runTsc: s.boolean,
});

export class ConfigError extends Error {
    [Symbol.toStringTag]: 'ConfigError'
    toString() {
        return 'ConfigError: ' + this.message;
    }
}

function stringify(value: any): string {
    return inspect(value, {breakLength: Infinity});
}


export class ConfigGetter extends ASTManipulator {

    key: string = '';
    value: any = undefined;

    constructor(fullPath: string, raw: string, scope?: Scope) {
        super(fullPath, raw, scope);
    }

    transform(program: b.Program): string {
        let out = '';
        let wasDefaultExported = false;
        for (let node of program.body) {
            this.setSourceData(node);
            if (node.type === 'ImportDeclaration') {
                let code = 'const {';
                let isNamespace = false;
                for (let spec of node.specifiers) {
                    this.setSourceData(spec);
                    if (spec.type === 'ImportSpecifier') {
                        out += `${this.getRaw(spec.imported)}: ${spec.local.name}, `;
                    } else if (spec.type === 'ImportDefaultSpecifier') {
                        out += `default: ${spec.local.name}, `;
                    } else {
                        isNamespace = true;
                        code = 'const ' + spec.local.name;
                    }
                }
                if (!isNamespace) {
                    out += '}';
                }
                out += ` = await import(${this.getRaw(node.source)});\n`;
            } else if (node.type === 'ExportNamedDeclaration') {
                if (node.declaration) {
                    this.error('SyntaxError', 'Only default exports can be exported from configuration files');
                }
                let id: string | null = null;
                for (let spec of node.specifiers) {
                    this.setSourceData(spec);
                    if (spec.type === 'ExportSpecifier') {
                        let exported = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value;
                        if (exported !== 'default') {
                            this.error('SyntaxError', 'Only default exports can be exported from configuration files');
                        }
                        id = spec.local.name;
                        break;
                    } else if (spec.type === 'ExportNamespaceSpecifier') {
                        id = spec.exported.name;
                        if (id !== 'default') {
                            this.error('SyntaxError', 'Only default exports can be exported from configuration files');
                        }
                    } else {
                        this.error('InternalError', 'I don\'t know what a ExportDefaultSpecifier is');
                    }
                }
                if (!id) {
                    continue;
                }
                wasDefaultExported = true;
                if (node.source) {
                    out += `return (await import(${this.getRaw(node.source)}))[${id}];\n`;
                } else {
                    out += `return ${id};\n`;
                }
            } else if (node.type === 'ExportDefaultDeclaration') {
                wasDefaultExported = true;
                out += `return ${this.getRaw(node.declaration)};\n`;
            } else if (node.type === 'ExportAllDeclaration') {
                wasDefaultExported = true;
                out += `return (await import(${this.getRaw(node.source)})).default;\n`;
            } else {
                out += this.getRaw(node);
            }
        }
        if (!wasDefaultExported) {
            this.error('SyntaxError', 'Configuration files must export default a value');
        }
        return 'return (async () => {' + out + '})();';
    }

    configError(expected: string, isExpected: boolean = true): never {
        let msg: string;
        if (isExpected) {
            msg = `Expected ${expected}, got ${this.value}`;
            if (this.key !== '') {
                msg += ` (at ${this.key})`;
            }
        } else {
            msg = expected;
        }
        throw new ConfigError(msg);
    }

    validate(value: unknown, schema: Schema): void {
        let oldKey = this.key;
        this.value = value;
        switch (schema.type) {
            case 'undefined':
                if (value !== undefined) {
                    this.configError('undefined');
                }
                break;
            case 'null':
                if (value !== null) {
                    this.configError('null');
                }
                break;
            case 'boolean':
            case 'number':
            case 'string':
            case 'symbol':
            case 'bigint':
                if (typeof value !== schema.type) {
                    this.configError(schema.type);
                }
                if (schema.value !== undefined) {
                    if (value !== schema.value) {
                        this.configError(stringify(schema.value));
                    }
                }
                break;
            case 'object':
                if (!value || !(typeof value === 'object' || typeof value === 'function')) {
                    this.configError('object');
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
                    this.configError('array');
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
                    this.configError(`Cannot find match for union:\n${errors.map(([i, msg]) => `    Tried overload ${i}, got '${msg}'`).join('\n')}`, false);
                }
                break;
        }
    }

    async main(code: string): Promise<Config> | never {
        code = this.transform(parser.parse(code).program);
        let out = await ((new Function(code))() as Promise<any>);
        this.validate(out, SCHEMA);
        return out;
    }

}


export async function parseConfig(path: string, code: string): Promise<Config> {
    return (new ConfigGetter(path, code)).main(code);
}

