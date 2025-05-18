
import {join, resolve, dirname} from 'node:path';
import * as fs from 'node:fs';
import * as t from './types.js';
import {Type} from './types.js';
import {CompilerError, Scope} from './util.js';
import config, {getAbsPath} from './config.js';
import {Inferrer} from './inferrer.js';
import {parse, ParseResult} from './parser.js';


export interface File<T extends ParseResult = ParseResult> {
    path: string;
    type: string;
    id: string;
    exports: Map<string, [Type, string]>;
    dependsOn: File[];
    code: string;
    ast: T;
    scope: Scope;
}

export let nextIDNum = 0;

export function getID(num?: number): string {
    if (num === undefined) {
        num = nextIDNum++;
    }
    return num.toString(36);
}

const FILES: Map<string, File> = new Map();

export function getImportPath(path: string, relativeTo?: string): string {
    if (path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
        if (relativeTo) {
            path = resolve(dirname(relativeTo), path);
        }
        path = getAbsPath(path);
    } else {
        path = getAbsPath(join('node_modules', path));
    }
    let startPath = path;
    if (!fs.existsSync(path)) {
        let found = false;
        for (let ext in config.fileTypes) {
            path = startPath + ext;
            if (fs.existsSync(path)) {
                found = true;
                break;
            }
        }
        if (!found) {
            throw new CompilerError('ImportError', `Cannot resolve import '${startPath}'`, null);
        }
    }
    return path;
}

export function getImportTypeGetter(path: string): (importPath: string) => Type {
    return function(importPath: string): Type {
        let file = loadImport(importPath, path);
        return t.object(Object.fromEntries(Array.from(file.exports).map(x => [x[0], x[1][0]])));
    }
}

function getFile<T extends string>(path: string, type: T): File<ParseResult<T>> {
    let file = FILES.get(path);
    if (file) {
        // @ts-ignore
        return file;
    }
    let code = fs.readFileSync(getAbsPath(path)).toString();
    let ast = parse(code, path, type);
    let scope = new Scope();
    let inferrer = new Inferrer(path, code, scope);
    inferrer.getImportType = getImportTypeGetter(path);
    let dependsOn: File[] = [];
    if (ast.type === 'Program') {
        inferrer.program(ast);
        for (let node of ast.body) {
            if (node.type === 'ImportDeclaration') {
                dependsOn.push(loadImport(node.source.value, path));
            }
        }
    }
    let out: File<ParseResult<T>> = {
        path,
        type,
        id: getID(),
        exports: scope.exports,
        dependsOn,
        code,
        ast,
        scope,
    };
    // @ts-ignore
    FILES.set(path, out);
    return out;
}

function inferType(path: string): string {
    for (let ext in config.fileTypes) {
        if (path.endsWith(ext)) {
            return config.fileTypes[ext];
        }
    }
    throw new CompilerError('ImportError', `Cannot find valid extension for file '${path}'`, null);
}

export function loadImport(path: string, relativeTo?: string): File {
    return getFile(getImportPath(path, relativeTo), inferType(path));
}

export function loadFile(path: string): File {
    return getFile(resolve(path), inferType(path));
}
