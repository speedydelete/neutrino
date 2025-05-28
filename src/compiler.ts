
import {join, resolve, dirname} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import {t, Type, CompilerError, Scope, changeExtension} from './util.js';
import {Config, loadConfig} from './config.js';
import {Inferrer} from './inferrer.js';
import {UnionFuncCall, createUnionFunc} from './unions.js';
import {Generator} from './generator.js';


export interface File {
    path: string;
    type: string;
    id: string;
    exports: Map<string, [Type, string]>;
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


export class Compiler {

    config: Config;
    cache: Map<string, File> = new Map();
    unionFuncCalls: UnionFuncCall[] = [];
    builtinPath: string;
    sharedPath: string;

    constructor(config?: Config) {
        this.config = config ?? loadConfig();
        // @ts-ignore
        this.builtinPath = join(import.meta.dirname, '../internal/index.c');
        this.sharedPath = join(this.config.rootDir, 'shared.c');
    }

    getAbsPath(path: string): string {
        return resolve(this.config.rootDir, path);
    }

    getPathFromRoot(path: string): string {
        return this.getAbsPath(path).slice(this.config.rootDir.length);
    }

    getImportPath(path: string, relativeTo?: string): string {
        if (path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
            if (relativeTo) {
                path = resolve(dirname(relativeTo), path);
            }
            path = this.getAbsPath(path);
        } else {
            path = this.getAbsPath(join('node_modules', path));
        }
        let startPath = path;
        if (!fs.existsSync(path)) {
            let found = false;
            for (let ext in this.config.fileTypes) {
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

    getImportTypeGetter(path: string): (importPath: string) => Type {
        return (importPath: string): Type => {
            let file = this.loadImport(importPath, path);
            return t.object(Object.fromEntries(Array.from(file.exports).map(x => [x[0], x[1][0]])));
        }
    }

    parse(code: string, path: string, type: string) {
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
            if (error && typeof error === 'object' && error instanceof SyntaxError && 'code' in error && error.code === 'BABEL_PARSER_SYNTAX_ERROR' && 'loc' in error && error.loc && typeof error.loc === 'object' && 'index' in error.loc && typeof error.loc.index === 'number' && 'line' in error.loc && typeof error.loc.line === 'number' && 'column' in error.loc && typeof error.loc.column === 'number') {
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
        // @ts-ignore
        return ast;
    }

    getFile(path: string): File {
        let file = this.cache.get(path);
        if (file) {
            // @ts-ignore
            return file;
        }
        let type: string | null = null;
        for (let ext in this.config.fileTypes) {
            if (path.endsWith(ext)) {
                type = this.config.fileTypes[ext];
                break;
            }
        }
        if (type === null) {
            throw new CompilerError('TypeError', `Unrecognized file type: ${path}`, null);
        }
        let code = fs.readFileSync(this.getAbsPath(path)).toString();
        let ast = this.parse(code, path, type);
        let scope = new Scope();
        let inferrer = new Inferrer(this, path, code, scope);
        inferrer.getImportType = this.getImportTypeGetter(path);
        let dependsOn: File[] = [];
        if (ast.type === 'Program') {
            inferrer.program(ast);
            for (let node of ast.body) {
                if (node.type === 'ImportDeclaration') {
                    dependsOn.push(this.loadImport(node.source.value, path));
                }
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
        this.cache.set(path, out);
        return out;
    }

    inferType(path: string): string {
        throw new CompilerError('ImportError', `Cannot find valid extension for file '${path}'`, null);
    }

    loadImport(path: string, relativeTo?: string): File {
        return this.getFile(this.getImportPath(path, relativeTo));
    }

    loadFile(path: string): File {
        return this.getFile(resolve(path));
    }

    transform(file: File): string {
        let gen = new Generator(this, file.id, file.path, file.code);
        gen.infer.getImportType = this.getImportTypeGetter(file.path);
        gen.getImportData = (path: string) => {
            path = this.getImportPath(path, file.path);
            let file_ = this.loadFile(path);
            return [path, file_.id, file_.scope];
        };
        return gen.program(file.ast);
    }

    _transformAll(file: File, ids: Set<string>, usedIds: Set<string> = new Set()): Set<string> {
        if (ids.has(file.id)) {
            return usedIds;
        }
        let path = this.getAbsPath(file.path);
        let code = this.transform(file);
        if (this.config.outDir) {
            path = this.config.outDir + path.slice(this.config.rootDir.length);
        }
        fs.writeFileSync(path + '.c', `\n$ifndef NEUTRINO_FILE_${file.id}\n#define NEUTRINO_FILE_${file.id}\n\n#include "${this.builtinPath}"\n#include "${this.sharedPath}"\n${code.slice(1)}\n#endif\n\n`);
        usedIds.add(file.id);
        for (let dep of file.dependsOn) {
            this._transformAll(dep, ids, usedIds);
        }
        ids.add(file.id);
        return usedIds;
    }

    transformAll(): void {
        let ids: Set<string> = new Set();
        for (let path of this.config.files) {
            let file = this.loadFile(path);
            let usedIds = this._transformAll(file, ids);
            path = this.getAbsPath(path);
            let code = fs.readFileSync(path + '.c').toString();
            let body = '    init(argc, argv);\n' + Array.from(usedIds).map(id => `    main_${id}();`).join('\n');
            fs.writeFileSync(path + '.c', code + `\n\nint main(int argc, char** argv) {\n${body}\n}\n`);
        }
    }

    _compilePath(path: string, link: boolean = false, deps: string[] = []): void {
        path = resolve(this.config.rootDir, path);
        let options = '';
        if (link && deps.length > 0) {
            options += deps.map(path => path + '.o').join(' ') + ' ';
        }
        options += path;
        if (link) {
            options += ' -o ' + changeExtension(path, '');
        } else {
            options += ' -c -o ' + path.slice(0, -2) + '.o';
        }
        if (this.config.optimization > 0) {
            options += ' -O' + this.config.optimization;
        }
        execSync(`${this.config.cc} ${this.config.cflags} ${options} ${this.config.ldflags}`);
    }

    getAllDependancies(file: File): string[] {
        return file.dependsOn.map(file => file.path).concat(...file.dependsOn.map(file => this.getAllDependancies(file)));

    }

    compilePath(path: string, link: boolean = true): void {
        let file = this.loadFile(path);
        file.dependsOn.forEach(file => this._compilePath(path, false));
        this._compilePath(file.path + '.c', link, this.getAllDependancies(file));
    }

    compileAll(): void {
        for (let path of this.config.files) {
            this.compilePath(path);
        }
    }

    run(): void {
        this.transformAll();
        this.compileAll();
    }

}


export function compile(config?: Config): void {
    (new Compiler(config)).run();
}
