
import {join, resolve, dirname} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';
import {Scope} from './util.js';
import {Generator} from './generator.js';
import {File, loadFile, getImportTypeGetter, getImportPath} from './imports.js';
import config, {Config, setConfig, getAbsPath} from './config.js';


export function transform(file: File, config_?: Config): {code: string, header: string} {
    if (config_) {
        setConfig(config_);
    }
    let scope = new Scope();
    let gen = new Generator(file.id, file.path, file.code, scope);
    gen.infer.getImportType = getImportTypeGetter(file.path);
    gen.getImportData = function(path: string) {
        path = getImportPath(path, file.path);
        let file_ = loadFile(path);
        return [path, file_.id, file_.scope];
    };
    let code = gen.program(file.ast);
    gen.scope = scope;
    return {
        code,
        header: gen.getDeclarations(),
    }
}


function getAllFiles(dir?: string): string[] {
    dir ??= config.rootDir;
    let out: string[] = [];
    for (let file of fs.readdirSync(dir)) {
        for (let ext in config.fileTypes) {
            if (file.endsWith(ext)) {
                out.push(join(dir, file));
                break;
            }
        }
    }
    return out;
}

let transformedIds: string[] = [];

function _transformAll(file: File): string[] {
    let ids: string[] = [];
    let path = getAbsPath(file.path);
    let {code, header} = transform(file);
    if (config.outDir) {
        path = config.outDir + path.slice(config.rootDir.length);
    }
    fs.writeFileSync(path + '.c', code);
    fs.writeFileSync(path + '.h', `\n#ifndef NEUTRINO_FILE_${file.id}\n#define NEUTRINO_FILE_${file.id}\n\n${header}\n\n#endif`);
    for (let dep of file.dependsOn) {
        if (!transformedIds.includes(dep.id)) {
            ids.push(..._transformAll(dep));
        }
    }
    ids.push(file.id);
    transformedIds.push(file.id);
    return ids;
}

export function transformAll(config_?: Config): void {
    if (config_) {
        setConfig(config_);
    }
    let files = config.files ?? getAllFiles();
    for (let path of files) {
        let file = loadFile(path);
        transformedIds = [];
        let ids = _transformAll(file);
        path = getAbsPath(path);
        let code = fs.readFileSync(path + '.c').toString();
        let body = '    init(argc, argv);\n' + ids.map(id => `    main_${id}();`);
        fs.writeFileSync(path + '.c', code + `\n\nint main(int argc, char** argv) {\n${body}\n}`);
    }
}


function changeExtension(path: string, ext: string): string {
    let dir = dirname(path);
    path = path.slice(dir.length + 1);
    if (path.startsWith('.')) {
        path = path.slice(0, path.slice(1).indexOf('.'));
    } else {
        path = path.slice(0, path.indexOf('.'));
    }
    return join(dir, path) + ext;
}

let builtinPaths: string[] = [];

function getBuiltinPaths(dir: string): void {
    for (let _path of fs.readdirSync(dir)) {
        let path = join(dir, _path);
        if (fs.statSync(path).isDirectory()) {
            getBuiltinPaths(path);
        } else if (path.endsWith('.c')) {
            builtinPaths.push(path);
        }
    }
}
getBuiltinPaths(join(import.meta.dirname, '../builtins'));

export function compilePath(path: string, link: boolean = false): void {
    path = resolve(config.rootDir, path);
    let options = path + ' ';
    if (link) {
        options += builtinPaths.map(path => changeExtension(path, '.o')).join(' ') + ' -o ' + changeExtension(path, '');
    } else {
        options += '-c -o ' + path.slice(0, -2) + '.o';
    }
    execSync(`${config.cc} ${config.cflags} ${options} ${config.ldflags}`);
}

let compiledIds: string[] = [];

function _compile(file: File): void {
    if (compiledIds.includes(file.id)) {
        return;
    }
    file.dependsOn.forEach(_compile);
    compilePath(file.path + '.c', true);
    compiledIds.push(file.id);
}

export function compile(file: File): void {
    compiledIds = [];
    _compile(file);
}

export function compileAll(): void {
    let files = config.files ?? getAllFiles();
    for (let path of files) {
        _compile(loadFile(path));
    }
}

export function compileBuiltins(): void {
    builtinPaths.forEach(path => compilePath(path));
}

export function transformAndCompileAll(config_?: Config): void {
    transformAll(config_);
    compileBuiltins();
    compileAll();
}
