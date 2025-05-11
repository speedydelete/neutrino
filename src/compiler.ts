
import {join, resolve, dirname} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';
import {Scope} from './util.js';
import {Generator} from './generator.js';
import {File, getID, loadFile} from './imports.js';
import config, {Config, setConfig, getAbsPath} from './config.js';


export function transform(file: File, config_?: Config): {code: string, header: string} {
    if (config_) {
        setConfig(config_);
    }
    let scope = new Scope();
    let gen = new Generator(getID(), file.path, file.code, scope);
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
        fs.writeFileSync(path + '.c', code + `\n\nint main(char* argc, char** argv) {\n${body}\n}`);
    }
}


export function compilePath(path: string, link: boolean = false): void {
    path = resolve(config.rootDir, path);
    let options: string;
    if (link) {
        let dir = dirname(path.slice(0, -2));
        let file = path.slice(dir.length, -2);
        if (file.startsWith('.')) {
            file = file.slice(0, file.slice(1).indexOf('.'));
        } else {
            file = file.slice(0, file.indexOf('.'));
        }
        options = ' -o ' + file;
    } else {
        options = ' -c -o ' + path.slice(0, -2) + '.o';
    }
    execSync(`${config.cc} ${config.cflags} ${path} ${options}`);
}

let compiledIds: string[] = [];

export function compileDependancies(file: File): void {
    if (compiledIds.includes(file.id)) {
        return;
    }
    for (let dep of file.dependsOn) {
        compileDependancies(dep);
        compilePath(dep.path);
    }
    compilePath(file.path);
    compiledIds.push(file.id);
}

export function compile(file: File): void {
    compiledIds = [];
    file.dependsOn.forEach(compileDependancies);
    compilePath(file.path, true);
}

export function compileAll(): void {
    let files = config.files ?? getAllFiles();
    for (let path of files) {
        compile(loadFile(path));
    }
}

function _compileInDirectoryRecursive(dir: string): void {
    for (let _path of fs.readdirSync(dir)) {
        let path = join(dir, _path);
        if (fs.statSync(path).isDirectory()) {
            _compileInDirectoryRecursive(dir);
        } else if (path.endsWith('.c')) {
            compilePath(path);
        }
    }
}

export function compileBuiltins(): void {
    _compileInDirectoryRecursive(join(import.meta.dirname, import.meta.filename, '..', 'builtins'));
}

export function transformAndCompileAll(config_?: Config): void {
    transformAll(config_);
    compileBuiltins();
    compileAll();
}
