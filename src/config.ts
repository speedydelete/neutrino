
import {join, resolve} from 'node:path';
import * as fs from 'node:fs';
import {CompilerError} from './util.js';


export interface Config {
    files?: string[];
    fileTypes: {[key: string]: string};
    rootDir: string;
    outDir: string;
    moduleDir: string;
    cc: string;
    cflags: string;
    ldflags: string;
    useDefaultCflags: boolean;
    useDefaultLdflags: boolean;
}


const FILE_TYPES = {
    '.js': 'text/javascript',
    '.cjs': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.jsx': 'test/javascript-jsx',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript-jsx',
};
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
    return value;
}

export let config: Config = validate({files: []});

export function setConfig(newConfig: Partial<Config>): void {
    Object.assign(config, validate(newConfig));
}

export async function loadConfig(): Promise<Config> {
    const PATHS = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'].map(x => 'neutrino.config' + x);
    let config: Config | null = null;
    for (let path of PATHS) {
        let fullPath = join(rootDir, path);
        if (fs.existsSync(fullPath)) {
            let module = (await import(fullPath));
            if ('default' in module) {
                module = module.default;
            }
            config = validate(module);
            break;
        }
    }
    if (config === null) {
        throw new CompilerError('ConfigError', 'Cannot find configuration file', null);
    }
    setConfig(config);
    return config;
}

export default config;


export function getAbsPath(path: string): string {
    return resolve(config.rootDir, path);
}

export function getPathFromRoot(path: string): string {
    return getAbsPath(path).slice(config.rootDir.length);
}
