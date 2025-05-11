
import {join, resolve} from 'node:path';
import * as fs from 'node:fs';
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types.js';
import {Type} from './types.js';
import {CompilerError, Scope} from './util.js';
import config, {getAbsPath, getPathFromRoot} from './config.js';
import {Inferrer} from './inferrer.js';


export interface File {
    path: string;
    type: string;
    id: string;
    exports: Map<string, Type>;
    dependsOn: File[];
    code: string;
    ast: b.Program;
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

function getFile(path: string, type: string): File {
    let file = FILES.get(path);
    if (file) {
        return file;
    }
    let code = fs.readFileSync(getAbsPath(path)).toString();
    let plugins: parser.ParserPlugin[] = [];
    if (type === 'text/typescript' || type === 'text/typescript-jsx') {
        plugins.push('typescript');
    } else if (type === 'text/javascript-jsx' || type === 'text/typescript-jsx') {
        plugins.push('jsx');
    }
    let ast: b.Program;
    try {
        ast = parser.parse(code, {
            plugins,
            sourceType: 'module',
            sourceFilename: path,
        }).program;
    } catch (error) {
        if (error && typeof error === 'object' && error instanceof SyntaxError && 'code' in error && typeof error.code === 'string' && error.code === 'BABEL_PARSER_SYNTAX_ERROR' && 'loc' in error && error.loc && typeof error.loc === 'object' && 'index' in error.loc && typeof error.loc.index === 'number' && 'line' in error.loc && typeof error.loc.line === 'number' && 'column' in error.loc && typeof error.loc.column === 'number') {
            let [type, msg] = error.message.split(': ');
            let index = error.loc.index;
            throw new CompilerError(type, msg, {
                raw: code.slice(index, index + 1),
                fullRaw: code,
                file: path,
                line: error.loc.line,
                col: error.loc.column,
            });
        } else {
            throw error;
        }
    }
    let scope = new Scope();
    let inferrer = new Inferrer(path, code, scope);
    inferrer.getImportType = function(importPath: string): Type {
        let file = loadImport(join(path, importPath));
        return t.object(Object.fromEntries(Array.from(file.exports)));
    };
    inferrer.program(ast);
    let dependsOn: File[] = [];
    for (let node of ast.body) {
        if (node.type === 'ImportDeclaration') {
            dependsOn.push(loadImport(node.source.value, path));
        }
    }
    let out: File = {
        path,
        type,
        id: getID(),
        exports: scope.exports,
        dependsOn,
        code,
        ast,
        scope,
    };
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
    let startPath: string;
    if (path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
        if (relativeTo) {
            path = resolve(relativeTo, path);
        }
        startPath = getAbsPath(path);
    } else {
        startPath = getAbsPath(join('node_modules', path));
    }
    path = getPathFromRoot(startPath);
    let type = '';
    if (!fs.existsSync(path)) {
        let found = false;
        for (let [ext, type] of Object.entries(config.fileTypes)) {
            path = startPath + ext;
            if (fs.existsSync(path)) {
                type = type;
                found = true;
                break;
            }
        }
        if (!found) {
            throw new CompilerError('ImportError', `Cannot resolve import '${path}'`, null);
        }
    } else {
        type = inferType(path);
    }
    return getFile(getPathFromRoot(path), type);
}

export function loadFile(path: string): File {
    return getFile(resolve(path), inferType(path));
}
