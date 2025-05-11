
import {join} from 'node:path';
import * as fs from 'node:fs';
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

function _transformAll(file: File): string[] {
    let ids: string[] = [file.id];
    let path = getAbsPath(file.path);
    let {code, header} = transform(file);
    if (config.outDir) {
        path = config.outDir + path.slice(config.rootDir.length);
    }
    fs.writeFileSync(path + '.c', code);
    fs.writeFileSync(path + '.h', `\n#ifndef NEUTRINO_FILE_${file.id}\n#define NEUTRINO_FILE_${file.id}\n\n${header}\n\n#endif`);
    for (let dep of file.dependsOn) {
        ids.push(..._transformAll(dep));
    }
    return ids;
}

export function transformAll(config_?: Config): void {
    if (config_) {
        setConfig(config_);
    }
    let files = config.files ?? getAllFiles();
    for (let path of files) {
        let file = loadFile(path);
        let ids = _transformAll(file);
        path = getAbsPath(path);
        let code = fs.readFileSync(path + '.c').toString();
        let body = '';
        fs.writeFileSync(path + '.c', code + `\n\nint main(char* argc, char** argv) {\n${body}\n}`);
    }
}


export function compile(path: string): void {
    
}

export function compileBuiltins(): void {
    
}

export function compileAll(path: string): void {

}
