
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
import * as fs from 'node:fs';
import {CompilerError} from './util.js';


export interface Config {
    files: string[];
    fileTypes: {[key: string]: string};
    rootDir: string;
    outDir: string;
    moduleDir: string;
    cc: string;
    cflags: string;
    ldflags: string;
    useDefaultCflags: boolean;
    useDefaultLdflags: boolean;
    optimization: number;
}


const FILE_TYPES = {
    '.js': 'text/javascript',
    '.cjs': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.jsx': 'test/javascript-jsx',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript-jsx',
    '.es': 'text/javascript',
};
const DEFAULT_EXTS = Object.keys(FILE_TYPES);
const CFLAGS = '-Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter';
const LDFLAGS = '-lm -lgc';

function error(message: string): never {
    throw new CompilerError('ConfigError', message, null);
}

let rootDir = process.cwd();
while (!fs.existsSync(join(rootDir, 'package.json') && join(rootDir, 'node_modules'))) {
    rootDir = join(rootDir, '..');
}
if (rootDir === '') {
    error('Cannot find project root');
}

function validateKey<K extends string, F extends (arg: any) => arg is any>(value: any, key: K, type: F, defaultValue: any, transformer?: (value: any) => any, mustBe?: string): asserts value is {[key in K]: (F extends (arg: any) => arg is infer U ? U : any)} {
    if (key in value && value[key] !== undefined) {
        if (!(typeof type === 'string' ? typeof value[key] === type : type(value[key]))) {
            let thing = String(mustBe ?? type);
            let article = 'aeiou'.includes(value[0]) ? 'an' : 'a';
            error(`Key ${key} must be a ${mustBe ?? type}`);
        }
        if (transformer) {
            value[key] = transformer(value[key]);
        }
    } else {
        value[key] = defaultValue;
    }
}

const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';
const isString = (x: unknown): x is string => typeof x === 'string';
const isNumber = (x: unknown): x is number => typeof x === 'number';
const resolveRootDir = (value: string) => resolve(rootDir, value);

function validate(value: unknown): Config {
    if (!value || typeof value !== 'object') {
        error(`Expected object, got ${value}`);
    }
    validateKey(value, 'files', x => Array.isArray(x) && x.every(y => typeof y === 'string'), [], undefined, 'array of strings');
    validateKey(value, 'fileTypes', (x: unknown): x is {[key: string]: string} => Boolean(x && typeof x === 'object' && Object.values(x).every(y => typeof y === 'string')), FILE_TYPES, undefined, 'object mapping strings to strings');
    validateKey(value, 'rootDir', isString, rootDir, resolveRootDir);
    validateKey(value, 'outDir', isString, value.rootDir, resolveRootDir);
    validateKey(value, 'moduleDir', isString, value.rootDir, resolveRootDir);
    validateKey(value, 'cc', isString, 'gcc');
    validateKey(value, 'cflags', isString, '');
    validateKey(value, 'ldflags', isString, '');
    validateKey(value, 'useDefaultCflags', isBoolean, true);
    validateKey(value, 'useDefaultLdflags', isBoolean, true);
    if (value.useDefaultCflags) {
        value.cflags = CFLAGS + ' ' + value.cflags;
    }
    if (value.useDefaultLdflags) {
        value.ldflags = LDFLAGS + ' ' + value.ldflags;
    }
    validateKey(value, 'optimization', isNumber, 3);
    return value;
}


export function getFiles(dir: string, exts: string[]): string[] {
    let out: string[] = [];
    for (let filename of fs.readdirSync(dir)) {
        let path = join(dir, filename);
        if (fs.statSync(path).isDirectory()) {
            out.push(...getFiles(path, exts));
        } else if (exts.some(x => path.endsWith(x))) {
            out.push(path);
        }
    }
    return out;
}

export function loadConfig(): Config {
    const PATHS = DEFAULT_EXTS.map(x => 'neutrino.config' + x);
    let config: Config | null = null;
    for (let path of PATHS) {
        let fullPath = join(rootDir, path);
        if (fs.existsSync(fullPath)) {
            // @ts-ignore
            let module = createRequire(import.meta.url)(path);
            if ('default' in module) {
                module = module.default;
            }
            config = validate(module);
            break;
        }
    }
    if (config === null) {
        config = validate({files: getFiles(rootDir, DEFAULT_EXTS)});
        throw new CompilerError('ConfigError', 'Cannot find configuration file', null);
    }
    return config;
}
